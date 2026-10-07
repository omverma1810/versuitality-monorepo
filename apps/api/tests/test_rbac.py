"""Role-based access control is enforced by the API, not just hidden in the UI.

Every row states which roles may reach an endpoint. Allowed roles must get past the
permission layer (anything but 401/403 -- an empty POST then fails validation with
400); every other role must get exactly 403; anonymous callers get 401.
"""
from __future__ import annotations

import uuid

import pytest

from apps.accounts.models import Role

A, S, M, Q, C = Role.ADMIN, Role.STAFF, Role.MASTER, Role.QA, Role.ACCOUNTANT
ALL = {A, S, M, Q, C}
ZERO = str(uuid.uuid4())  # a well-formed id that does not exist

MATRIX = [
    # method, path, roles allowed
    ('GET', '/api/clients/', {A, S, M}),
    ('POST', '/api/clients/', {A, S}),
    ('GET', '/api/clients/search/?q=a', {A, S, M}),
    ('GET', '/api/clients/by_mobile/?mobile=9810000001', {A, S, M}),
    ('GET', '/api/measurements/', {A, S, M}),
    ('POST', '/api/measurements/', {A, S}),
    ('GET', '/api/orders/', {A, S, M, Q, C}),
    ('POST', '/api/orders/', {A, S}),
    ('GET', '/api/orders/stats/', {A, S, M, Q, C}),
    ('GET', '/api/orders/transitions_map/', {A, S, M, Q, C}),
    ('POST', f'/api/orders/{ZERO}/transition/', {A, S, M, Q}),
    ('GET', f'/api/orders/{ZERO}/pdf/', {A, S, M, C}),
    ('GET', '/api/qa/checklist/', ALL),
    ('GET', '/api/qa/queue/', {A, Q}),
    ('GET', '/api/qa/inspections/', ALL),
    ('POST', '/api/qa/inspections/submit/', {A, Q}),
    ('GET', '/api/notifications/', {A, S}),
    ('GET', '/api/fabrics/', {A, S, M}),
    ('POST', '/api/fabrics/', {A, S}),
    ('GET', '/api/fabrics/low_stock/', {A, S, M}),
    ('POST', f'/api/fabrics/{ZERO}/adjust/', {A, S, M}),
    ('GET', '/api/fabric-usage/', {A, S, M}),
    ('GET', '/api/appointments/', {A, S}),
    ('POST', '/api/appointments/', {A, S}),
    ('GET', '/api/appointments/today/', {A, S}),
    ('GET', '/api/analytics/summary/', {A, C}),
    ('GET', '/api/analytics/orders.xlsx/', {A, C}),
    ('GET', '/api/users/', {A}),
    ('POST', '/api/users/', {A}),
    ('GET', '/api/auth/me/', ALL),
]


def _id(row):
    method, path, _ = row
    return f'{method} {path.split("?")[0].replace(ZERO, "<id>")}'


def _call(client, method, path):
    if method == 'POST':
        return client.post(path, {}, format='json')
    return client.get(path)


@pytest.mark.parametrize('row', MATRIX, ids=_id)
def test_role_matrix(api, row):
    method, path, allowed = row
    for role in ALL:
        resp = _call(api[role], method, path)
        if role in allowed:
            assert resp.status_code not in (401, 403), f'{role} should reach {method} {path}: {resp.status_code}'
        else:
            assert resp.status_code == 403, f'{role} must be denied {method} {path}: {resp.status_code}'

    assert _call(api['anon'], method, path).status_code == 401


@pytest.mark.parametrize('role', sorted(ALL))
@pytest.mark.parametrize('method', ['put', 'patch', 'delete'])
def test_orders_cannot_be_edited_or_deleted_over_the_api(api, order, role, method):
    """PATCH {"status": ...} would bypass the state machine and the audit trail."""
    url = f'/api/orders/{order["id"]}/'
    payload = {'status': 'delivered'} if method != 'delete' else None
    resp = getattr(api[role], method)(url, payload, format='json')
    assert resp.status_code in (403, 405)
    assert api[Role.ADMIN].get(url).json()['status'] == 'order_received'


def test_qa_only_sees_orders_awaiting_inspection(api, make_order):
    waiting = make_order()
    received = make_order()
    for step in ['requirements_noted', 'cutting_started', 'stitching_in_progress',
                 'ready_for_trial', 'ready_for_qc']:
        assert api[A].post(f'/api/orders/{waiting["id"]}/transition/', {'target': step}, format='json').status_code == 200

    ids = {o['id'] for o in api[Q].get('/api/orders/').json()['results']}
    assert ids == {waiting['id']}
    assert api[Q].get(f'/api/orders/{received["id"]}/').status_code == 404
    stats = api[Q].get('/api/orders/stats/').json()
    assert stats['total'] == 1


def test_qa_keeps_access_to_orders_they_inspected(api, order):
    for step in ['requirements_noted', 'cutting_started', 'stitching_in_progress',
                 'ready_for_trial', 'ready_for_qc']:
        api[A].post(f'/api/orders/{order["id"]}/transition/', {'target': step}, format='json')
    checklist = {i['key']: {'result': 'pass', 'note': ''} for i in api[Q].get('/api/qa/checklist/').json()['items']}
    resp = api[Q].post('/api/qa/inspections/submit/',
                       {'order': order['id'], 'outcome': 'pass', 'checklist': checklist}, format='json')
    assert resp.status_code == 201
    assert api[Q].get(f'/api/orders/{order["id"]}/').json()['status'] == 'ready_for_delivery'
