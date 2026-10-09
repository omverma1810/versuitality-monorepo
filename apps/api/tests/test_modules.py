from __future__ import annotations

import io
import uuid

import pytest
from PIL import Image

from apps.accounts.models import Role
from apps.inventory.models import Fabric, FabricUsage

from .conftest import move, walk_to

pytestmark = pytest.mark.django_db
A, S, M, Q, C = Role.ADMIN, Role.STAFF, Role.MASTER, Role.QA, Role.ACCOUNTANT


# ------------------------------------------------------------------------ CRM
def test_client_gets_a_unique_id_and_normalised_mobile(api):
    resp = api[S].post('/api/clients/', {'full_name': 'Rohan Iyer', 'mobile': '+91 98100-00002'}, format='json')
    assert resp.status_code == 201
    body = resp.json()
    assert body['client_id'].startswith('VS-CL-') and body['mobile'] == '+919810000002'


@pytest.mark.parametrize('typed', [
    '9810000001', '09810000001', '98100 00001', '+91 98100-00001', '919810000001', '0091 9810000001', '+919810000001',
])
def test_every_way_of_typing_a_number_is_the_same_client(api, client_record, typed):
    """One person must never become two profiles because of how the number was typed."""
    dup = api[S].post('/api/clients/', {'full_name': 'Someone Else', 'mobile': typed}, format='json')
    assert dup.status_code == 400
    match = api[S].get('/api/clients/by_mobile/', {'mobile': typed}).json()['match']
    assert match and match['id'] == client_record['id']


@pytest.mark.parametrize('typed,stored', [
    ('9810000001', '+919810000001'), ('098100 00001', '+919810000001'),
    ('+44 7700 900123', '+447700900123'), ('0044 7700 900123', '+447700900123'), ('', ''), ('abc', ''),
])
def test_mobile_normalisation(typed, stored):
    from apps.crm.utils import normalise_mobile

    assert normalise_mobile(typed) == stored


@pytest.mark.parametrize('query', ['aarav', 'AARAV', '0001', '9810000001', 'VS-CL-'])
def test_one_search_box_finds_the_client(api, client_record, query):
    results = api[S].get('/api/clients/search/', {'q': query}).json()['results']
    assert [r['id'] for r in results] == [client_record['id']]


def test_clients_list_search_filters_the_page(api, client_record):
    """The Clients page sends ?search=; it used to be ignored and return everyone."""
    api[S].post('/api/clients/', {'full_name': 'Someone Else', 'mobile': '+919810000077'}, format='json')
    assert api[S].get('/api/clients/').json()['count'] == 2
    for term in ('aarav', '0001', 'VS-CL-'):
        got = api[S].get('/api/clients/', {'search': term}).json()
        assert [r['id'] for r in got['results']][:1] == [client_record['id']] or term == 'VS-CL-'
    only = api[S].get('/api/clients/', {'search': 'aarav'}).json()
    assert only['count'] == 1 and only['results'][0]['id'] == client_record['id']
    assert api[S].get('/api/clients/', {'search': 'zzz-nobody'}).json()['count'] == 0


def test_invalid_preferences_are_rejected(api):
    resp = api[S].post('/api/clients/', {'full_name': 'X Y', 'mobile': '+919810000003',
                                         'occasion_preferences': ['skydiving']}, format='json')
    assert resp.status_code == 400


# ---------------------------------------------------------------- measurements
def test_measurement_history_and_excel_export(api, client_record, measurement):
    again = api[S].post('/api/measurements/', {'client': client_record['id'], 'garment_types': ['trouser'],
                                               'garment_count': 1, 'lower_waist': '34'}, format='json')
    assert again.status_code == 201
    history = api[M].get('/api/measurements/', {'client': client_record['id']}).json()
    assert history['count'] == 2

    export = api[M].get(f'/api/clients/{client_record["id"]}/measurements/export/')
    assert export.status_code == 200 and export.content[:2] == b'PK'  # xlsx is a zip
    assert 'spreadsheetml' in export['Content-Type']


def test_measurement_out_of_range_is_rejected(api, client_record):
    resp = api[S].post('/api/measurements/', {'client': client_record['id'], 'garment_types': ['shirt'],
                                              'upper_chest': '999'}, format='json')
    assert resp.status_code == 400


def test_cloth_image_upload_is_stored(api, client_record, settings):
    buf = io.BytesIO()
    Image.new('RGB', (20, 20), (203, 166, 36)).save(buf, 'PNG')
    buf.seek(0)
    buf.name = 'swatch.png'
    resp = api[S].post('/api/measurements/', {
        'client': client_record['id'], 'garment_count': 1, 'garment_types': '["shirt"]', 'cloth_image': buf,
    }, format='multipart')
    assert resp.status_code == 201, resp.content
    assert resp.json()['cloth_image'].endswith('.png')
    assert any(settings.MEDIA_ROOT.rglob('*.png'))


# ------------------------------------------------------------------- inventory
def _fabric(api, qty='10', threshold='2'):
    resp = api[S].post('/api/fabrics/', {'name': 'Test wool', 'quantity_meters': qty, 'low_stock_threshold': threshold,
                                         'cost_per_meter': '100', 'price_per_meter': '200', 'pattern': 'solid'}, format='json')
    assert resp.status_code == 201, resp.content
    return resp.json()


def test_order_deducts_fabric_stock_and_writes_a_ledger_entry(api, client_record, measurement):
    fabric = _fabric(api)
    resp = api[S].post('/api/orders/', {
        'client': client_record['id'], 'measurement_set': measurement['id'], 'order_type': 'full',
        'line_items': [{'garment_type': 'suit', 'quantity': 1, 'unit_price': '30000',
                        'fabric': fabric['id'], 'meters_used': '3.5'}],
    }, format='json')
    assert resp.status_code == 201
    assert float(Fabric.objects.get(pk=fabric['id']).quantity_meters) == 6.5
    entry = FabricUsage.objects.get(fabric_id=fabric['id'])
    assert float(entry.delta_meters) == -3.5 and entry.kind == 'order' and entry.order_id


def test_insufficient_stock_rolls_the_whole_order_back(api, client_record):
    from apps.orders.models import Order

    fabric = _fabric(api, qty='1')
    resp = api[S].post('/api/orders/', {
        'client': client_record['id'], 'order_type': 'full',
        'line_items': [{'garment_type': 'suit', 'quantity': 1, 'unit_price': '1', 'fabric': fabric['id'], 'meters_used': '5'}],
    }, format='json')
    assert resp.status_code == 400
    assert Order.objects.count() == 0
    assert float(Fabric.objects.get(pk=fabric['id']).quantity_meters) == 1.0


def test_manual_adjustments_and_low_stock_alert(api):
    fabric = _fabric(api, qty='6', threshold='5')
    assert api[A].get('/api/fabrics/low_stock/').json()['count'] == 0
    out = api[M].post(f'/api/fabrics/{fabric["id"]}/adjust/', {'delta_meters': '-2', 'kind': 'wastage'}, format='json')
    assert out.status_code == 201
    low = api[S].get('/api/fabrics/low_stock/').json()
    assert low['count'] == 1 and low['results'][0]['is_low_stock'] is True
    restock = api[S].post(f'/api/fabrics/{fabric["id"]}/adjust/', {'delta_meters': '20', 'kind': 'restock'}, format='json')
    assert restock.status_code == 201 and float(restock.json()['fabric']['quantity_meters']) == 24.0
    over = api[S].post(f'/api/fabrics/{fabric["id"]}/adjust/', {'delta_meters': '-100', 'kind': 'adjustment'}, format='json')
    assert over.status_code == 400
    assert api[S].post(f'/api/fabrics/{fabric["id"]}/adjust/', {'delta_meters': '0', 'kind': 'adjustment'}, format='json').status_code == 400


# ---------------------------------------------------------------- appointments
def test_appointment_snapshot_reminders_and_status_changes(api, client_record):
    from datetime import timedelta

    from django.utils import timezone

    from apps.appointments.models import Appointment
    from apps.appointments.services import send_due_reminders
    from apps.notifications.models import Notification

    when = timezone.now() + timedelta(minutes=90)
    resp = api[S].post('/api/appointments/', {'client': client_record['id'], 'scheduled_at': when.isoformat(),
                                              'kind': 'measurement', 'notify_via': 'both'}, format='json')
    assert resp.status_code == 201
    appt = resp.json()
    assert appt['full_name'] == 'Aarav Mehta' and appt['mobile'] == '+919810000001'  # snapshotted from the client

    assert send_due_reminders(lead_minutes=120) == 1
    assert send_due_reminders(lead_minutes=120) == 0  # idempotent
    assert Appointment.objects.get(pk=appt['id']).reminder_sent_at
    assert Notification.objects.filter(template_key='appointment_reminder').count() == 2  # email + whatsapp

    done = api[S].post(f'/api/appointments/{appt["id"]}/transition/', {'status': 'completed'}, format='json')
    assert done.status_code == 200 and done.json()['status'] == 'completed'


def test_appointments_cannot_be_booked_in_the_past(api, client_record):
    from datetime import timedelta

    from django.utils import timezone

    past = timezone.now() - timedelta(days=1)
    resp = api[S].post('/api/appointments/', {'client': client_record['id'], 'scheduled_at': past.isoformat(),
                                              'kind': 'trial'}, format='json')
    assert resp.status_code == 400


# ------------------------------------------------------------------------- QA
def _checklist(api, fail=()):
    items = api[Q].get('/api/qa/checklist/').json()['items']
    return {i['key']: {'result': 'fail' if i['key'] in fail else 'pass', 'note': 'bunching' if i['key'] in fail else ''}
            for i in items}


def test_qa_validation_rules(api, order):
    oid = order['id']
    walk_to(api, oid, 'ready_for_qc')
    first_key = next(iter(_checklist(api)))
    assert api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'pass', 'checklist': {}}, format='json').status_code == 400
    assert api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'pass',
                       'checklist': _checklist(api, fail=[first_key])}, format='json').status_code == 400   # pass with a failure
    assert api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'fail',
                       'checklist': _checklist(api)}, format='json').status_code == 400                    # fail with none
    no_context = _checklist(api, fail=[first_key])
    no_context[first_key]['note'] = ''
    assert api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'fail', 'checklist': no_context},
                       format='json').status_code == 400                                                    # fail without a reason


def test_qa_rejection_and_rework_loop_are_recorded(api, order):
    oid = order['id']
    walk_to(api, oid, 'ready_for_qc')
    key = next(iter(_checklist(api)))
    rejected = api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'fail', 'overall_comment': 'Redo the shoulder',
                           'checklist': _checklist(api, fail=[key])}, format='json')
    assert rejected.status_code == 201 and rejected.json()['failed_items'] == [key]
    assert api[A].get(f'/api/orders/{oid}/').json()['status'] == 'qc_rejected'

    # Cannot inspect an order that is not waiting for QC.
    assert api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'pass', 'checklist': _checklist(api)},
                       format='json').status_code == 400
    for step in ('stitching_in_progress', 'ready_for_trial', 'ready_for_qc'):
        assert move(api, oid, step, M).status_code == 200
    assert api[Q].post('/api/qa/inspections/submit/', {'order': oid, 'outcome': 'pass', 'checklist': _checklist(api)},
                       format='json').status_code == 201
    history = api[M].get('/api/qa/inspections/', {'order': oid}).json()['results']
    assert [h['outcome'] for h in history] == ['pass', 'fail']  # newest first
    assert api[Q].get('/api/qa/queue/').json()['count'] == 0


# ------------------------------------------------------------------- analytics
def test_analytics_summary_matches_the_data(api, make_order):
    a = make_order()
    make_order()
    walk_to(api, a['id'], 'ready_for_qc')
    key = next(iter(_checklist(api)))
    api[Q].post('/api/qa/inspections/submit/', {'order': a['id'], 'outcome': 'fail', 'overall_comment': 'x',
                'checklist': _checklist(api, fail=[key])}, format='json')

    summary = api[C].get('/api/analytics/summary/').json()
    assert summary['mom']['current']['count'] == 2
    assert summary['mom']['current']['revenue'] == 18000.0
    assert summary['kpis']['active_orders'] == 2 and summary['kpis']['active_clients'] == 1
    dist = {d['status']: d['count'] for d in summary['status_distribution']}
    assert dist['qc_rejected'] == 1 and dist['order_received'] == 1
    assert summary['qc_stats'] == {'total': 1, 'failed': 1, 'rate': 1.0}
    assert summary['garment_breakdown'][0]['garment_type'] == 'shirt' and summary['garment_breakdown'][0]['count'] == 4
    assert summary['top_clients'][0]['order_count'] == 2
    assert len(summary['revenue_trend']) >= 1
    assert api[A].get('/api/analytics/orders.xlsx/').content[:2] == b'PK'
    assert api[A].get('/api/analytics/summary/', {'from': '2020-01-01', 'to': '2020-01-02'}).json()['mom']['current']['count'] == 2


def test_notification_log_is_readable_by_staff(api, order):
    rows = api[S].get('/api/notifications/', {'order': order['id']}).json()
    assert rows['count'] == 2  # email + whatsapp "order received"
    assert {r['channel'] for r in rows['results']} == {'email', 'whatsapp'}
    assert all(r['provider'].startswith('console:') and r['status'] == 'sent' for r in rows['results'])
    assert str(uuid.UUID(order['id']))


# ------------------------------------------------------------------- audit log
def test_audit_log_is_admin_only_and_records_activity(api, users):
    api['anon'].post('/api/auth/login/', {'email': users[S].email, 'password': 'Str0ng-Test-Pass!'}, format='json')
    got = api[A].get('/api/audit/')
    assert got.status_code == 200 and got.json()['count'] >= 1
    row = got.json()['results'][0]
    assert {'action', 'actor_name', 'created_at'} <= set(row)
    assert api[A].get('/api/audit/', {'action': 'login'}).json()['count'] >= 1
    for role in (S, M, Q, C):
        assert api[role].get('/api/audit/').status_code == 403
    assert api['anon'].get('/api/audit/').status_code == 401
    assert api[A].post('/api/audit/', {}, format='json').status_code == 405


# ------------------------------------------------- returning-customer recognition
def _line(**kw):
    return {'garment_type': 'shirt', 'quantity': 1, 'unit_price': '1000', **kw}


def test_by_mobile_returns_the_profile_needed_to_prefill_an_order(api, client_record, make_order):
    older = api[S].post('/api/measurements/', {'client': client_record['id'], 'garment_types': ['shirt'],
                                               'upper_chest': '40'}, format='json').json()
    newest = api[S].post('/api/measurements/', {'client': client_record['id'], 'garment_types': ['suit'],
                                                'upper_chest': '41', 'upper_waist': '35'}, format='json').json()
    first = make_order(line_items=[_line(garment_type='suit', fabric_description='Navy wool', unit_price='30000',
                                         customization_notes='Peak lapel')])
    second = make_order(line_items=[_line(garment_type='shirt', quantity=2)])

    body = api[S].get('/api/clients/by_mobile/', {'mobile': '98100 00001'}).json()
    assert body['match']['id'] == client_record['id'] and body['matched_on'] == 'mobile'
    profile = body['profile']
    assert profile['latest_measurement']['id'] == newest['id'] != older['id']
    assert profile['latest_measurement']['upper_chest'] == '41.00'
    assert profile['measurement_age_days'] == 0 and profile['order_count'] == 2
    assert [o['order_id'] for o in profile['recent_orders']] == [second['order_id'], first['order_id']]
    repeat = profile['recent_orders'][1]['line_items'][0]
    assert (repeat['garment_type'], repeat['fabric_description'], repeat['customization_notes']) == ('suit', 'Navy wool', 'Peak lapel')


def test_by_mobile_also_recognises_the_alternate_number(api):
    created = api[S].post('/api/clients/', {'full_name': 'Two Phones', 'mobile': '+919810000088',
                                            'alt_mobile': '98100 00089'}, format='json')
    assert created.status_code == 201, created.content
    body = api[S].get('/api/clients/by_mobile/', {'mobile': '9810000089'}).json()
    assert body['match']['full_name'] == 'Two Phones' and body['matched_on'] == 'alt_mobile'


def test_by_mobile_for_a_new_number_and_for_a_half_typed_one(api):
    fresh = api[S].get('/api/clients/by_mobile/', {'mobile': '9810099999'}).json()
    assert fresh['match'] is None and fresh['profile'] is None and fresh['normalised'] == '+919810099999'
    assert api[S].get('/api/clients/by_mobile/', {'mobile': '98100'}).json()['match'] is None


def test_profile_ignores_cancelled_orders_and_works_without_history(api, client_record, make_order):
    brand_new = api[S].post('/api/clients/', {'full_name': 'No History', 'mobile': '+919810000066'}, format='json').json()
    empty = api[S].get(f'/api/clients/{brand_new["id"]}/profile/').json()
    assert empty['latest_measurement'] is None and empty['recent_orders'] == [] and empty['order_count'] == 0
    kept, dropped = make_order(), make_order()
    api[S].post(f'/api/orders/{dropped["id"]}/cancel/', {'reason': 'x'}, format='json')
    profile = api[S].get(f'/api/clients/{client_record["id"]}/profile/').json()
    assert [o['order_id'] for o in profile['recent_orders']] == [kept['order_id']] and profile['order_count'] == 1


def test_client_list_reports_the_real_order_count(api, client_record, make_order):
    make_order(), make_order()
    row = api[S].get('/api/clients/', {'search': 'aarav'}).json()['results'][0]
    assert row['order_count'] == 2


@pytest.mark.parametrize('role', [Q, C])
def test_only_front_of_house_can_look_customers_up_by_mobile(api, client_record, role):
    assert api[role].get('/api/clients/by_mobile/', {'mobile': '9810000001'}).status_code == 403
    assert api[role].get(f'/api/clients/{client_record["id"]}/profile/').status_code == 403
