"""Appointment notifications + reminder dispatch."""
from __future__ import annotations

import logging

from django.utils import timezone

from apps.notifications.models import Channel
from apps.notifications.services import _dispatch_one  # internal but stable
from apps.notifications.templates import TEMPLATES

from .models import Appointment, NotifyVia

logger = logging.getLogger(__name__)


def _first_name(full_name: str) -> str:
    return (full_name or 'there').strip().split(' ', 1)[0] or 'there'


def _build_context(appt: Appointment) -> dict:
    when = timezone.localtime(appt.scheduled_at)
    return {
        'client_first_name': _first_name(appt.full_name),
        'appointment_kind': appt.get_kind_display().lower(),
        'appointment_when': when.strftime('%a, %d %b %Y · %I:%M %p').replace('  ', ' '),
        'appointment_time': when.strftime('%I:%M %p').lstrip('0'),
    }


def _channels_for(appt: Appointment) -> list[str]:
    if appt.notify_via == NotifyVia.NONE:
        return []
    if appt.notify_via == NotifyVia.EMAIL:
        return [Channel.EMAIL] if appt.email else []
    if appt.notify_via == NotifyVia.WHATSAPP:
        return [Channel.WHATSAPP] if appt.mobile else []
    # both
    return [
        c
        for c, addr in (
            (Channel.EMAIL, appt.email),
            (Channel.WHATSAPP, appt.mobile),
        )
        if addr
    ]


def _dispatch(appt: Appointment, template_key: str) -> int:
    """Returns the number of dispatch attempts that produced a row."""
    template = TEMPLATES.get(template_key)
    if template is None or not template.notify_client:
        return 0
    context = _build_context(appt)
    sent = 0
    for channel in _channels_for(appt):
        addr = appt.email if channel == Channel.EMAIL else appt.mobile
        n = _dispatch_one(
            channel=channel,
            template_key=template_key,
            to=addr,
            context=context,
            order=None,
            metadata={'appointment_id': str(appt.id)},
        )
        if n:
            sent += 1
    return sent


def notify_appointment_scheduled(appt: Appointment) -> int:
    try:
        return _dispatch(appt, 'appointment_scheduled')
    except Exception:
        logger.exception('appointment_scheduled dispatch failed')
        return 0


def send_due_reminders(*, lead_minutes: int = 120) -> int:
    """Find scheduled appointments that fall within ``lead_minutes`` from now
    and that haven't been reminded yet, then fire the reminder template.

    Idempotent — safe to invoke from cron at any cadence.
    """
    now = timezone.now()
    horizon = now + timezone.timedelta(minutes=lead_minutes)
    qs = Appointment.objects.filter(
        status='scheduled',
        reminder_sent_at__isnull=True,
        scheduled_at__gte=now,
        scheduled_at__lte=horizon,
    )
    sent = 0
    for appt in qs:
        if appt.notify_via == NotifyVia.NONE:
            appt.reminder_sent_at = now
            appt.save(update_fields=['reminder_sent_at'])
            continue
        try:
            _dispatch(appt, 'appointment_reminder')
            appt.reminder_sent_at = now
            appt.save(update_fields=['reminder_sent_at'])
            sent += 1
        except Exception:
            logger.exception('Reminder dispatch failed for %s', appt.id)
    return sent
