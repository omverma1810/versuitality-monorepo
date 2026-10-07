"""Health, migrations, database hardening, seeding and the WebSocket layer."""
from __future__ import annotations

import json

import pytest
from channels.testing import WebsocketCommunicator
from django.core.management import call_command
from django.db import connection

from apps.accounts.models import Role, User

from .conftest import api_as

ALLOWED_ORIGIN = b'http://localhost:3000'


# ----------------------------------------------------------------------- health
@pytest.mark.django_db
def test_health_and_readiness(client):
    assert client.get('/api/health/').json()['status'] == 'ok'
    ready = client.get('/api/readiness/')
    assert ready.status_code == 200
    checks = ready.json()['checks']
    assert checks['postgres']['status'] == 'ok'
    assert checks['redis']['status'] in ('skipped', 'ok')


# ------------------------------------------------------------------- migrations
@pytest.mark.django_db
def test_no_model_changes_are_missing_a_migration():
    """Fails when someone edits a model but forgets `makemigrations`."""
    call_command('makemigrations', check=True, dry_run=True, verbosity=0)


# ----------------------------------------------------------------- RLS lock-down
@pytest.mark.django_db(transaction=True)
def test_enable_rls_protects_unprotected_tables_and_is_idempotent(capsys):
    with connection.cursor() as cur:
        cur.execute('create table public.leaky_table (id int)')
        cur.execute("select rowsecurity from pg_tables where tablename = 'leaky_table'")
        assert cur.fetchone()[0] is False
    try:
        call_command('enable_rls')
        with connection.cursor() as cur:
            cur.execute("select count(*) from pg_tables where schemaname = 'public' and not rowsecurity")
            assert cur.fetchone()[0] == 0
        call_command('enable_rls')  # second run changes nothing
        assert 'RLS enabled on 0 table(s)' in capsys.readouterr().out
    finally:
        with connection.cursor() as cur:
            cur.execute('drop table public.leaky_table')


# ------------------------------------------------------------------ seed command
@pytest.mark.django_db
def test_seed_owners_reads_the_password_from_the_environment(monkeypatch):
    monkeypatch.setenv('SEED_OWNER_PASSWORD', 'Owner-Pass-12345')
    call_command('seed_owners')
    owners = User.objects.filter(role=Role.ADMIN)
    assert owners.count() == 3 and all(o.is_active and o.check_password('Owner-Pass-12345') for o in owners)
    call_command('seed_owners')  # idempotent
    assert User.objects.count() == 3


# --------------------------------------------------------------------- websockets
def _application():
    from versuitality.asgi import application

    return application


async def _connect(token: str | None, origin: bytes = ALLOWED_ORIGIN):
    path = '/ws/orders/' + (f'?token={token}' if token else '')
    comm = WebsocketCommunicator(_application(), path, headers=[(b'origin', origin)])
    connected, _ = await comm.connect()
    return comm, connected


@pytest.mark.django_db(transaction=True)
async def test_websocket_requires_a_valid_token_and_allowed_origin():
    from channels.db import database_sync_to_async
    from rest_framework_simplejwt.tokens import AccessToken

    user = await database_sync_to_async(User.objects.create_user)(
        'ws@test.example', 'Str0ng-Test-Pass!', full_name='WS User', role=Role.MASTER
    )
    token = str(AccessToken.for_user(user))

    comm, ok = await _connect(token)
    assert ok
    hello = json.loads(await comm.receive_from())
    assert hello['kind'] == 'hello' and hello['role'] == 'master'
    await comm.disconnect()

    for bad_token, origin in ((None, ALLOWED_ORIGIN), ('garbage', ALLOWED_ORIGIN), (token, b'https://evil.example')):
        comm, ok = await _connect(bad_token, origin)
        assert not ok, f'connection should be refused for token={bad_token!r} origin={origin!r}'


@pytest.mark.django_db(transaction=True)
async def test_order_events_are_pushed_live_to_connected_clients():
    from asgiref.sync import sync_to_async
    from channels.db import database_sync_to_async
    from rest_framework_simplejwt.tokens import AccessToken

    def setup():
        admin = User.objects.create_user('ws-admin@test.example', 'Str0ng-Test-Pass!', full_name='Admin', role=Role.ADMIN)
        staff = User.objects.create_user('ws-staff@test.example', 'Str0ng-Test-Pass!', full_name='Staff', role=Role.STAFF)
        return admin, staff

    admin, staff = await database_sync_to_async(setup)()
    comm, ok = await _connect(str(AccessToken.for_user(admin)))
    assert ok
    await comm.receive_from()  # hello

    def create_order():
        api = api_as(staff)
        client = api.post('/api/clients/', {'full_name': 'Live Test', 'mobile': '+919810000099'}, format='json').json()
        return api.post('/api/orders/', {'client': client['id'], 'order_type': 'full',
                        'line_items': [{'garment_type': 'shirt', 'quantity': 1, 'unit_price': '100'}]}, format='json').json()

    created = await sync_to_async(create_order)()
    event = json.loads(await comm.receive_from(timeout=5))
    assert event['kind'] == 'order_created' and event['order']['order_id'] == created['order_id']
    await comm.disconnect()


# ------------------------------------------------------------- production guards
def test_production_refuses_to_start_with_the_development_secret(monkeypatch):
    import importlib

    from django.core.exceptions import ImproperlyConfigured

    import versuitality.settings as settings_module

    monkeypatch.setenv('DJANGO_DEBUG', '0')
    monkeypatch.delenv('DJANGO_SECRET_KEY', raising=False)
    with pytest.raises(ImproperlyConfigured):
        importlib.reload(settings_module)
    monkeypatch.setenv('DJANGO_DEBUG', '1')
    importlib.reload(settings_module)
