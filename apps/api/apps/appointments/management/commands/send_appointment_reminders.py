"""Idempotent appointment reminder dispatcher.

Run via cron once Twilio + SendGrid are wired:

    */5 * * * *  python manage.py send_appointment_reminders --lead 120

Without external creds, this still produces Notification rows via the
console provider so reminders can be reviewed in the in-app log.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.appointments.services import send_due_reminders


class Command(BaseCommand):
    help = 'Send reminders for upcoming appointments within `--lead` minutes.'

    def add_arguments(self, parser):
        parser.add_argument('--lead', type=int, default=120,
                            help='Lead window in minutes (default 120 = 2 hours)')

    def handle(self, *args, **opts):
        sent = send_due_reminders(lead_minutes=opts['lead'])
        self.stdout.write(self.style.SUCCESS(f'Reminders dispatched: {sent}'))
