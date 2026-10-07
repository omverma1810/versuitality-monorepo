"""Lock down the Supabase Data API for every table the app owns.

The Django API talks to Postgres directly as the table owner, which bypasses
Row Level Security. Supabase additionally exposes every ``public`` table through
its REST "Data API", guarded only by RLS and by privileges granted to the
``anon`` / ``authenticated`` roles. This app never uses that API, so we turn
RLS on for every table and strip those roles' privileges.

Idempotent and safe to run on every deploy (the production entrypoint does, right
after ``migrate``, so tables added by future migrations are covered too). It is a
no-op on non-PostgreSQL databases, and skips the role clean-up when the Supabase
roles do not exist.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection

DATA_API_ROLES = ('anon', 'authenticated')


class Command(BaseCommand):
    help = 'Enable RLS on all public tables and revoke Supabase Data API role privileges.'

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            self.stdout.write('Not PostgreSQL - nothing to do.')
            return

        quote = connection.ops.quote_name
        with connection.cursor() as cur:
            cur.execute(
                "select tablename from pg_tables "
                "where schemaname = 'public' and not rowsecurity order by 1"
            )
            unprotected = [row[0] for row in cur.fetchall()]
            for table in unprotected:
                cur.execute(f'alter table public.{quote(table)} enable row level security')
            self.stdout.write(
                f'RLS enabled on {len(unprotected)} table(s)'
                + (f': {", ".join(unprotected)}' if unprotected else ' (all already protected).')
            )

            cur.execute('select rolname from pg_roles where rolname = any(%s)', [list(DATA_API_ROLES)])
            roles = [row[0] for row in cur.fetchall()]
            for role in roles:
                cur.execute(f'revoke all on all tables in schema public from {quote(role)}')
                cur.execute(f'revoke all on all sequences in schema public from {quote(role)}')
            if roles:
                self.stdout.write(f'Revoked table/sequence privileges from: {", ".join(roles)}')
