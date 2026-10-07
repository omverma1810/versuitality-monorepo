"""Shared fixtures: one user per role and an API client authenticated as each."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import Role, User

PASSWORD = 'Str0ng-Test-Pass!'
ROLES = [Role.ADMIN, Role.STAFF, Role.MASTER, Role.QA, Role.ACCOUNTANT]


def api_as(user: User | None) -> APIClient:
    client = APIClient()
    if user is not None:
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(user)}')
    return client


@pytest.fixture(autouse=True)
def _fast_test_settings(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / 'media'
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']  # tests only


@pytest.fixture
def make_user(db):
    counter = {'n': 0}

    def _make(role: str = Role.STAFF, **extra) -> User:
        counter['n'] += 1
        return User.objects.create_user(
            email=extra.pop('email', f'{role}{counter["n"]}@test.example'),
            password=extra.pop('password', PASSWORD),
            full_name=extra.pop('full_name', f'Test {role.title()} {counter["n"]}'),
            role=role,
            **extra,
        )

    return _make


@pytest.fixture
def users(make_user) -> dict[str, User]:
    return {role: make_user(role) for role in ROLES}


@pytest.fixture
def api(users) -> dict[str, APIClient]:
    """Authenticated clients keyed by role, plus ``anon``."""
    clients = {role: api_as(user) for role, user in users.items()}
    clients['anon'] = api_as(None)
    return clients


@pytest.fixture
def client_record(api):
    resp = api[Role.STAFF].post(
        '/api/clients/',
        {'full_name': 'Aarav Mehta', 'mobile': '+919810000001', 'email': 'aarav@example.com'},
        format='json',
    )
    assert resp.status_code == 201, resp.content
    return resp.json()


@pytest.fixture
def measurement(api, client_record):
    resp = api[Role.STAFF].post(
        '/api/measurements/',
        {
            'client': client_record['id'],
            'garment_types': ['shirt'],
            'garment_count': 1,
            'upper_chest': '42',
            'upper_waist': '36',
        },
        format='json',
    )
    assert resp.status_code == 201, resp.content
    return resp.json()


@pytest.fixture
def make_order(api, client_record, measurement):
    def _make(**overrides):
        payload = {
            'client': client_record['id'],
            'measurement_set': measurement['id'],
            'order_type': 'full',
            'line_items': [
                {'garment_type': 'shirt', 'quantity': 2, 'unit_price': '4500'},
            ],
        }
        payload.update(overrides)
        resp = api[Role.STAFF].post('/api/orders/', payload, format='json')
        assert resp.status_code == 201, resp.content
        return resp.json()

    return _make


@pytest.fixture
def order(make_order):
    return make_order()


def move(api, order_id: str, target: str, role: str, reason: str = ''):
    return api[role].post(
        f'/api/orders/{order_id}/transition/', {'target': target, 'reason': reason}, format='json'
    )


def walk_to(api, order_id: str, target: str) -> None:
    """Advance an order using the admin override (which may follow the normal flow)."""
    flow = [
        'requirements_noted', 'cutting_started', 'stitching_in_progress',
        'ready_for_trial', 'ready_for_qc', 'ready_for_delivery', 'delivered',
    ]
    for step in flow:
        resp = move(api, order_id, step, Role.ADMIN)
        assert resp.status_code == 200, resp.content
        if step == target:
            return
    raise AssertionError(f'unknown target {target}')
