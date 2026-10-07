from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import AuditAction, AuditLog, InviteToken, Role, User

from .conftest import PASSWORD, api_as

pytestmark = pytest.mark.django_db


def test_login_returns_tokens_and_role(make_user, api):
    make_user(Role.MASTER, email='master@test.example')
    resp = api['anon'].post('/api/auth/login/', {'email': 'MASTER@test.example', 'password': PASSWORD}, format='json')
    assert resp.status_code == 200
    body = resp.json()
    assert body['user']['role'] == 'master'
    assert body['tokens']['access'] and body['tokens']['refresh']
    assert AuditLog.objects.filter(action=AuditAction.LOGIN).exists()


@pytest.mark.parametrize('email,password', [
    ('nobody@test.example', PASSWORD),
    ('staff@test.example', 'wrong-password'),
])
def test_bad_credentials_rejected_and_audited(make_user, api, email, password):
    make_user(Role.STAFF, email='staff@test.example')
    resp = api['anon'].post('/api/auth/login/', {'email': email, 'password': password}, format='json')
    assert resp.status_code == 401
    assert AuditLog.objects.filter(action=AuditAction.LOGIN_FAILED).exists()


def test_inactive_user_cannot_log_in(make_user, api):
    make_user(Role.STAFF, email='gone@test.example', is_active=False)
    resp = api['anon'].post('/api/auth/login/', {'email': 'gone@test.example', 'password': PASSWORD}, format='json')
    assert resp.status_code == 401


def test_me_requires_a_valid_token(users, api):
    assert api['anon'].get('/api/auth/me/').status_code == 401
    me = api[Role.QA].get('/api/auth/me/').json()
    assert me['email'] == users[Role.QA].email and me['role'] == 'qa'


def test_deactivated_user_loses_access_immediately(users):
    client = api_as(users[Role.STAFF])
    assert client.get('/api/auth/me/').status_code == 200
    users[Role.STAFF].is_active = False
    users[Role.STAFF].save()
    assert client.get('/api/auth/me/').status_code == 401


def test_refresh_rotates_and_logout_blacklists_the_token(api):
    login = api['anon'].post('/api/auth/login/', {'email': 'x@test.example', 'password': PASSWORD}, format='json')
    assert login.status_code == 401  # no such user yet
    user = User.objects.create_user('real@test.example', PASSWORD, full_name='Real', role=Role.STAFF)
    tokens = api['anon'].post('/api/auth/login/', {'email': user.email, 'password': PASSWORD}, format='json').json()['tokens']

    refreshed = api['anon'].post('/api/auth/refresh/', {'refresh': tokens['refresh']}, format='json')
    assert refreshed.status_code == 200 and refreshed.json()['access']

    authed = api_as(user)
    assert authed.post('/api/auth/logout/', {'refresh': refreshed.json()['refresh']}, format='json').status_code == 204
    assert api['anon'].post('/api/auth/refresh/', {'refresh': refreshed.json()['refresh']}, format='json').status_code == 401


def test_invite_flow_activates_the_account_once(api):
    created = api[Role.ADMIN].post(
        '/api/users/', {'email': 'New.Hire@test.example', 'full_name': 'New Hire', 'role': 'master'}, format='json'
    )
    assert created.status_code == 201
    token = created.json()['invite']['token']
    user = User.objects.get(email='new.hire@test.example')
    assert user.is_active is False and not user.has_usable_password()

    info = api['anon'].get(f'/api/auth/invite/{token}/')
    assert info.status_code == 200 and info.json()['role'] == 'master'

    weak = api['anon'].post('/api/auth/setup-password/',
                            {'token': token, 'password': '12345678', 'password_confirm': '12345678'}, format='json')
    assert weak.status_code == 400
    mismatch = api['anon'].post('/api/auth/setup-password/',
                                {'token': token, 'password': PASSWORD, 'password_confirm': 'different'}, format='json')
    assert mismatch.status_code == 400

    ok = api['anon'].post('/api/auth/setup-password/',
                          {'token': token, 'password': PASSWORD, 'password_confirm': PASSWORD}, format='json')
    assert ok.status_code == 200 and ok.json()['user']['role'] == 'master'
    user.refresh_from_db()
    assert user.is_active and user.check_password(PASSWORD)

    again = api['anon'].post('/api/auth/setup-password/',
                             {'token': token, 'password': PASSWORD, 'password_confirm': PASSWORD}, format='json')
    assert again.status_code == 400  # single use
    assert api['anon'].get(f'/api/auth/invite/{token}/').status_code == 410


def test_expired_and_unknown_invites_are_refused(api):
    api[Role.ADMIN].post('/api/users/', {'email': 'late@test.example', 'full_name': 'Late', 'role': 'qa'}, format='json')
    invite = InviteToken.objects.get(user__email='late@test.example')
    InviteToken.objects.filter(pk=invite.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
    assert api['anon'].get(f'/api/auth/invite/{invite.token}/').status_code == 410
    assert api['anon'].get('/api/auth/invite/not-a-real-token/').status_code == 404


def test_duplicate_email_invite_rejected(api, users):
    resp = api[Role.ADMIN].post(
        '/api/users/', {'email': users[Role.STAFF].email.upper(), 'full_name': 'Dup', 'role': 'staff'}, format='json'
    )
    assert resp.status_code == 400


def test_admin_changes_role_and_deactivation_is_soft(api, users):
    uid = users[Role.STAFF].id
    assert api[Role.ADMIN].patch(f'/api/users/{uid}/', {'role': 'master'}, format='json').status_code == 200
    assert AuditLog.objects.filter(action=AuditAction.USER_ROLE_CHANGED, target_user_id=uid).exists()
    assert api[Role.ADMIN].delete(f'/api/users/{uid}/').status_code == 204
    assert User.objects.get(pk=uid).is_active is False  # kept for the audit history
