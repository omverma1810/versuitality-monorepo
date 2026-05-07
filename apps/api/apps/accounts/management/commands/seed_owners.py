"""Seed the three Versuitality owners as Admin invites.

Usage:
    python manage.py seed_owners
    python manage.py seed_owners --activate-with-password Versuitality@2026
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import InviteToken, Role, User

OWNERS = [
    {'full_name': 'Sirish Kumar Golem', 'email': 'sirish@versuitality.com'},
    {'full_name': 'Tripti Kumari Golem', 'email': 'tripti@versuitality.com'},
    {'full_name': 'Rahul Vankamamidi', 'email': 'rahul@versuitality.com'},
]


class Command(BaseCommand):
    help = 'Seed the three Versuitality owner accounts as Admins.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--activate-with-password',
            dest='password',
            default=None,
            help=(
                'If set, owners are created already-active with this shared dev '
                'password instead of as pending invites. For local dev only.'
            ),
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        password: str | None = opts.get('password')
        for owner in OWNERS:
            email = owner['email'].lower()
            existing = User.objects.filter(email__iexact=email).first()
            if existing:
                self.stdout.write(self.style.WARNING(f'· skip (exists) {email}'))
                continue

            if password:
                User.objects.create_user(
                    email=email,
                    full_name=owner['full_name'],
                    role=Role.ADMIN,
                    is_active=True,
                    is_staff=True,
                    password=password,
                )
                self.stdout.write(self.style.SUCCESS(
                    f'+ admin {owner["full_name"]} <{email}> (active, dev password)'
                ))
            else:
                user, invite = User.objects.invite(
                    email=email,
                    full_name=owner['full_name'],
                    role=Role.ADMIN,
                )
                user.is_staff = True
                user.save(update_fields=['is_staff'])
                self.stdout.write(self.style.SUCCESS(
                    f'+ invite {owner["full_name"]} <{email}>\n'
                    f'    setup-url: /setup-password?token={invite.token}'
                ))

        self.stdout.write(self.style.SUCCESS('Done.'))
