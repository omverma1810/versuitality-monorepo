from __future__ import annotations

import re
from decimal import Decimal

import pytest

from apps.accounts.models import Role
from apps.orders.models import Order

from .conftest import move, walk_to

pytestmark = pytest.mark.django_db
A, S, M, Q = Role.ADMIN, Role.STAFF, Role.MASTER, Role.QA


# ------------------------------------------------------------------- creation
def test_order_id_format_and_daily_sequence(make_order):
    first, second = make_order(), make_order()
    pattern = re.compile(r'^VS-\d{8}-\d{4}$')
    assert pattern.match(first['order_id']) and pattern.match(second['order_id'])
    assert first['order_id'][:11] == second['order_id'][:11]
    assert int(second['order_id'][-4:]) == int(first['order_id'][-4:]) + 1


def test_order_totals_and_initial_state(order):
    assert order['status'] == 'order_received'
    assert Decimal(order['subtotal']) == Decimal('9000')  # 2 x 4500, auto-rolled up
    assert len(order['line_items']) == 1
    assert [e['to_status'] for e in order['status_events']] == ['order_received']


def test_order_needs_a_line_item(api, client_record):
    resp = api[S].post('/api/orders/', {'client': client_record['id'], 'order_type': 'full', 'line_items': []}, format='json')
    assert resp.status_code == 400


def test_order_search_by_id_name_and_mobile(api, order):
    for q in (order['order_id'], 'aarav', '0001'):
        got = api[S].get('/api/orders/', {'q': q}).json()
        assert got['count'] == 1, q
    assert api[S].get('/api/orders/', {'q': 'zzz-nobody'}).json()['count'] == 0


# ---------------------------------------------------------------- state machine
def test_happy_path_by_the_right_roles(api, order):
    oid = order['id']
    steps = [
        ('requirements_noted', M), ('cutting_started', M), ('stitching_in_progress', M),
        ('ready_for_trial', M), ('ready_for_qc', M),
    ]
    for target, role in steps:
        assert move(api, oid, target, role).status_code == 200, target
    checklist = {i['key']: {'result': 'pass', 'note': ''} for i in api[Q].get('/api/qa/checklist/').json()['items']}
    assert api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'pass', 'checklist': checklist},
                       format='json').status_code == 201
    assert move(api, oid, 'delivered', S).status_code == 200

    final = api[A].get(f'/api/orders/{oid}/').json()
    assert final['status'] == 'delivered' and final['delivered_at']
    assert [e['to_status'] for e in final['status_events']][-1] == 'delivered'
    assert all(e['actor_name'] for e in final['status_events'])


@pytest.mark.parametrize('target,role', [
    ('cutting_started', S),            # skips a step
    ('requirements_noted', Q),         # QA cannot drive production
    ('ready_for_delivery', S),         # only QA may pass an order
    ('delivered', M),                  # only staff confirm delivery
])
def test_illegal_transitions_are_refused(api, order, target, role):
    resp = move(api, order['id'], target, role)
    assert resp.status_code in (400, 403, 404)  # 404: QA cannot even see this order
    assert api[A].get(f'/api/orders/{order["id"]}/').json()['status'] == 'order_received'


def test_staff_cannot_run_the_production_steps(api, order):
    assert move(api, order['id'], 'requirements_noted', M).status_code == 200
    assert move(api, order['id'], 'cutting_started', S).status_code == 403


def test_admin_can_force_any_status(api, order):
    resp = move(api, order['id'], 'ready_for_delivery', A)
    assert resp.status_code == 200 and resp.json()['order']['status'] == 'ready_for_delivery'


def test_same_status_is_rejected(api, order):
    assert move(api, order['id'], 'order_received', A).status_code == 400


def test_qc_rejection_needs_a_reason_and_can_loop_back(api, order):
    oid = order['id']
    walk_to(api, oid, 'ready_for_qc')
    assert move(api, oid, 'qc_rejected', A).status_code == 400  # no reason
    assert move(api, oid, 'qc_rejected', A, 'Shoulder seam puckers').status_code == 200
    assert move(api, oid, 'stitching_in_progress', M).status_code == 200
    assert move(api, oid, 'ready_for_trial', M).status_code == 200
    assert move(api, oid, 'ready_for_qc', M).status_code == 200


def test_delivered_is_terminal_for_everyone_but_admin(api, order):
    walk_to(api, order['id'], 'delivered')
    for role in (S, M, Q):
        assert move(api, order['id'], 'cutting_started', role).status_code in (400, 403, 404)


# --------------------------------------------------------------- read endpoints
def test_pdf_receipt(api, order):
    resp = api[S].get(f'/api/orders/{order["id"]}/pdf/')
    assert resp.status_code == 200 and resp['Content-Type'] == 'application/pdf'
    assert resp.content[:4] == b'%PDF' and order['order_id'] in resp['Content-Disposition']


def test_stats_reflect_orders(api, make_order):
    make_order(), make_order()
    stats = api[A].get('/api/orders/stats/').json()
    assert stats['total'] == 2 and stats['active'] == 2
    assert {b['status']: b['count'] for b in stats['by_status']}['order_received'] == 2


def test_status_change_is_audited_and_notifies_the_client(api, order):
    from apps.accounts.models import AuditLog
    from apps.notifications.models import Notification

    move(api, order['id'], 'requirements_noted', M)
    assert AuditLog.objects.filter(action='order_status_changed', metadata__to='requirements_noted').exists()
    keys = set(Notification.objects.filter(order_id=order['id']).values_list('template_key', flat=True))
    assert {'order_received', 'requirements_noted'} <= keys


def test_internal_qc_steps_do_not_message_the_client(api, order):
    from apps.notifications.models import Notification

    walk_to(api, order['id'], 'ready_for_qc')
    move(api, order['id'], 'qc_rejected', A, 'redo')
    keys = set(Notification.objects.filter(order_id=order['id']).values_list('template_key', flat=True))
    assert 'ready_for_qc' not in keys and 'qc_rejected' not in keys
    assert Order.objects.get(pk=order['id']).status == 'qc_rejected'


def test_order_create_accepts_a_client_supplied_position(api, client_record):
    """The web wizard sends `position` on each line; this used to 500."""
    resp = api[S].post('/api/orders/', {
        'client': client_record['id'], 'order_type': 'full',
        'line_items': [
            {'garment_type': 'shirt', 'quantity': 1, 'unit_price': '100', 'position': 0, 'meters_used': 0},
            {'garment_type': 'trouser', 'quantity': 1, 'unit_price': '200', 'position': 1, 'meters_used': 0},
        ],
    }, format='json')
    assert resp.status_code == 201, resp.content
    assert [li['position'] for li in resp.json()['line_items']] == [0, 1]


def test_pdf_receipt_works_without_a_linked_measurement_set(api, make_order):
    """Linking a measurement set is optional in the wizard; the receipt must still render."""
    bare = make_order(measurement_set=None)
    resp = api[S].get(f'/api/orders/{bare["id"]}/pdf/')
    assert resp.status_code == 200 and resp.content[:4] == b'%PDF'


# ------------------------------------------------------------------ editing
def _fabric(api, qty='20'):
    resp = api[A].post('/api/fabrics/', {'name': 'Test Wool', 'quantity_meters': qty, 'low_stock_threshold': '2',
                                         'cost_per_meter': '100', 'price_per_meter': '200'}, format='json')
    assert resp.status_code == 201, resp.content
    return resp.json()


def _stock(api, fabric_id):
    return Decimal(api[A].get(f'/api/fabrics/{fabric_id}/').json()['quantity_meters'])


def test_staff_can_edit_dates_advance_and_notes(api, order):
    resp = api[S].patch(f'/api/orders/{order["id"]}/', {'delivery_date': '2030-01-15', 'advance': '3000',
                                                        'notes': 'Client wants it earlier'}, format='json')
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body['delivery_date'] == '2030-01-15' and Decimal(body['advance']) == Decimal('3000')
    assert Decimal(body['balance']) == Decimal('6000') and body['status'] == 'order_received'


def test_edit_is_audited_with_what_changed(api, order):
    from apps.accounts.models import AuditLog

    api[S].patch(f'/api/orders/{order["id"]}/', {'advance': '1000'}, format='json')
    log = AuditLog.objects.filter(action='order_edited').latest('created_at')
    assert log.metadata['order_id'] == order['order_id'] and 'advance' in log.metadata['changes']


@pytest.mark.parametrize('role', [M, Q, Role.ACCOUNTANT])
def test_only_front_desk_can_edit_an_order(api, order, role):
    assert api[role].patch(f'/api/orders/{order["id"]}/', {'notes': 'x'}, format='json').status_code in (403, 404)


def test_status_cannot_be_changed_by_editing(api, order):
    resp = api[S].patch(f'/api/orders/{order["id"]}/', {'status': 'delivered'}, format='json')
    assert resp.status_code == 400
    assert api[A].get(f'/api/orders/{order["id"]}/').json()['status'] == 'order_received'


def test_advance_cannot_exceed_the_total(api, order):
    assert api[S].patch(f'/api/orders/{order["id"]}/', {'advance': '999999'}, format='json').status_code == 400


def test_garments_can_be_replaced_before_cutting_and_total_updates(api, order):
    resp = api[S].patch(f'/api/orders/{order["id"]}/', {'line_items': [
        {'garment_type': 'suit', 'quantity': 1, 'unit_price': '30000'},
        {'garment_type': 'shirt', 'quantity': 2, 'unit_price': '1500'},
    ]}, format='json')
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert Decimal(body['subtotal']) == Decimal('33000') and len(body['line_items']) == 2


def test_garments_are_locked_once_cutting_starts(api, order):
    move(api, order['id'], 'requirements_noted', M)
    move(api, order['id'], 'cutting_started', M)
    resp = api[S].patch(f'/api/orders/{order["id"]}/', {'line_items': [
        {'garment_type': 'suit', 'quantity': 1, 'unit_price': '1'}]}, format='json')
    assert resp.status_code == 400
    # ...but dates and notes still can change mid-production
    assert api[S].patch(f'/api/orders/{order["id"]}/', {'trial_date': '2030-02-01'}, format='json').status_code == 200


def test_editing_garments_keeps_fabric_stock_correct(api, client_record):
    fab = _fabric(api, '20')
    created = api[S].post('/api/orders/', {'client': client_record['id'], 'order_type': 'full', 'line_items': [
        {'garment_type': 'suit', 'quantity': 1, 'unit_price': '100', 'fabric': fab['id'], 'meters_used': '4'}]},
        format='json').json()
    assert _stock(api, fab['id']) == Decimal('16')
    api[S].patch(f'/api/orders/{created["id"]}/', {'line_items': [
        {'garment_type': 'suit', 'quantity': 1, 'unit_price': '100', 'fabric': fab['id'], 'meters_used': '6'}]},
        format='json')
    assert _stock(api, fab['id']) == Decimal('14')  # 4 returned, 6 taken


def test_delivered_orders_only_allow_settling_the_balance_and_notes(api, order):
    walk_to(api, order['id'], 'delivered')
    assert api[S].patch(f'/api/orders/{order["id"]}/', {'advance': '9000'}, format='json').status_code == 200
    assert api[S].patch(f'/api/orders/{order["id"]}/', {'delivery_date': '2031-01-01'}, format='json').status_code == 400


def test_measurement_set_must_belong_to_the_same_client(api, order):
    other = api[S].post('/api/clients/', {'full_name': 'Other Person', 'mobile': '+919810000055'}, format='json').json()
    ms = api[S].post('/api/measurements/', {'client': other['id'], 'garment_types': ['shirt'], 'upper_chest': '40'},
                     format='json')
    assert ms.status_code == 201, ms.content
    resp = api[S].patch(f'/api/orders/{order["id"]}/', {'measurement_set': ms.json()['id']}, format='json')
    assert resp.status_code == 400


# --------------------------------------------------------------- cancelling
def test_cancel_needs_a_reason(api, order):
    assert api[S].post(f'/api/orders/{order["id"]}/cancel/', {}, format='json').status_code == 400
    assert api[S].post(f'/api/orders/{order["id"]}/cancel/', {'reason': '  '}, format='json').status_code == 400


def test_cancel_records_reason_timeline_and_audit(api, order):
    from apps.accounts.models import AuditLog

    resp = api[S].post(f'/api/orders/{order["id"]}/cancel/', {'reason': 'Client changed their mind'}, format='json')
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body['status'] == 'cancelled' and body['next_statuses'] == []
    last = body['status_events'][-1]
    assert last['to_status'] == 'cancelled' and last['reason'] == 'Client changed their mind'
    assert AuditLog.objects.filter(action='order_cancelled', metadata__order_id=order['order_id']).exists()


@pytest.mark.parametrize('role', [M, Q, Role.ACCOUNTANT])
def test_only_front_desk_can_cancel(api, order, role):
    resp = api[role].post(f'/api/orders/{order["id"]}/cancel/', {'reason': 'x'}, format='json')
    assert resp.status_code in (403, 404)
    assert api[A].get(f'/api/orders/{order["id"]}/').json()['status'] == 'order_received'


def test_cancelled_is_final(api, order):
    api[S].post(f'/api/orders/{order["id"]}/cancel/', {'reason': 'x'}, format='json')
    for role in (S, M, A):
        assert move(api, order['id'], 'requirements_noted', role).status_code in (400, 403)
    assert api[S].patch(f'/api/orders/{order["id"]}/', {'notes': 'y'}, format='json').status_code == 400
    assert api[S].post(f'/api/orders/{order["id"]}/cancel/', {'reason': 'again'}, format='json').status_code == 400


def test_delivered_orders_cannot_be_cancelled(api, order):
    walk_to(api, order['id'], 'delivered')
    assert api[S].post(f'/api/orders/{order["id"]}/cancel/', {'reason': 'x'}, format='json').status_code == 400


def test_the_transition_endpoint_cannot_cancel_without_a_reason(api, order):
    assert move(api, order['id'], 'cancelled', A).status_code == 400


def test_cancelling_before_cutting_returns_fabric_by_default(api, client_record):
    fab = _fabric(api, '20')
    created = api[S].post('/api/orders/', {'client': client_record['id'], 'order_type': 'full', 'line_items': [
        {'garment_type': 'suit', 'quantity': 1, 'unit_price': '100', 'fabric': fab['id'], 'meters_used': '5'}]},
        format='json').json()
    assert _stock(api, fab['id']) == Decimal('15')
    api[S].post(f'/api/orders/{created["id"]}/cancel/', {'reason': 'x'}, format='json')
    assert _stock(api, fab['id']) == Decimal('20')


def test_cancelling_after_cutting_keeps_fabric_used_unless_asked(api, client_record):
    fab = _fabric(api, '20')
    created = api[S].post('/api/orders/', {'client': client_record['id'], 'order_type': 'full', 'line_items': [
        {'garment_type': 'suit', 'quantity': 1, 'unit_price': '100', 'fabric': fab['id'], 'meters_used': '5'}]},
        format='json').json()
    move(api, created['id'], 'requirements_noted', M)
    move(api, created['id'], 'cutting_started', M)
    api[S].post(f'/api/orders/{created["id"]}/cancel/', {'reason': 'x'}, format='json')
    assert _stock(api, fab['id']) == Decimal('15')


def test_cancelled_orders_are_left_out_of_active_counts_and_revenue(api, make_order):
    keep, drop = make_order(), make_order()
    api[S].post(f'/api/orders/{drop["id"]}/cancel/', {'reason': 'x'}, format='json')
    stats = api[A].get('/api/orders/stats/').json()
    assert stats['total'] == 2 and stats['active'] == 1
    assert {b['status']: b['count'] for b in stats['by_status']}['cancelled'] == 1
    summary = api[A].get('/api/analytics/summary/').json()
    assert summary['kpis']['active_orders'] == 1
    assert summary['mom']['current']['count'] == 1
    assert keep['id']


def test_cancelled_order_receipt_still_renders(api, order):
    api[S].post(f'/api/orders/{order["id"]}/cancel/', {'reason': 'x'}, format='json')
    resp = api[S].get(f'/api/orders/{order["id"]}/pdf/')
    assert resp.status_code == 200 and resp.content[:4] == b'%PDF'


def test_next_statuses_only_lists_steps_the_role_may_take(api, order):
    """The UI renders these as buttons, so a master must never be offered QA's steps."""
    oid = order['id']
    walk_to(api, oid, 'ready_for_qc')
    offered = {role: api[role].get(f'/api/orders/{oid}/').json()['next_statuses'] for role in (S, M, Q, A)}
    assert offered[M] == [] and offered[S] == []
    assert set(offered[Q]) == {'ready_for_delivery', 'qc_rejected'}
    assert set(offered[A]) == {'ready_for_delivery', 'qc_rejected'}
    walk_to(api, oid, 'ready_for_delivery')
    assert api[S].get(f'/api/orders/{oid}/').json()['next_statuses'] == ['delivered']
    assert api[M].get(f'/api/orders/{oid}/').json()['next_statuses'] == []
