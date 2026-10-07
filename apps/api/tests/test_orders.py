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
