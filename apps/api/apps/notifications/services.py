"""High-level dispatch service used by the rest of the codebase.

The two public entry points — ``notify_order_created`` and
``notify_order_status_changed`` — are intentionally thin wrappers so call
sites stay simple. Both swallow exceptions; messaging is a best-effort
overlay on the durable HTTP API.
"""
from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone

from .models import Channel, DeliveryStatus, Notification
from .providers import get_email_provider, get_whatsapp_provider
from .templates import STATUS_TEMPLATE_MAP, TEMPLATES, Template

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Context building
# ---------------------------------------------------------------------------


def _first_name(full_name: str) -> str:
    return (full_name or 'there').strip().split(' ', 1)[0] or 'there'


def _trial_lines(order) -> tuple[str, str]:
    if not order.trial_date:
        return '', ''
    nice = order.trial_date.strftime('%a, %d %b %Y')
    return (
        f'— Trial date: {nice}\n',
        f'Trial date: {nice}\n',
    )


def _delivery_line(order) -> str:
    if not order.delivery_date:
        return '\n'
    nice = order.delivery_date.strftime('%a, %d %b %Y')
    return f'— Delivery target: {nice}\n\n'


def build_order_context(order) -> dict[str, Any]:
    client = order.client
    trial_long, trial_short = _trial_lines(order)
    summary = order.garment_summary or '—'
    return {
        'order_id': order.order_id,
        'client_full_name': client.full_name,
        'client_first_name': _first_name(client.full_name),
        'client_id': client.client_id,
        'garment_summary': summary,
        'maybe_trial_line': trial_long,
        'maybe_trial_line_short': trial_short,
        'maybe_delivery_line': _delivery_line(order),
    }


# ---------------------------------------------------------------------------
# Single-channel dispatch
# ---------------------------------------------------------------------------


def _render(template: Template, channel: str, context: dict[str, Any]) -> tuple[str, str]:
    """Render (subject, body). Subject is empty for non-email channels."""
    if channel == Channel.EMAIL:
        subject = template.email_subject.format_map(_SafeMap(context))
        body = template.email_body.format_map(_SafeMap(context))
        return subject, body
    body = template.whatsapp_body.format_map(_SafeMap(context))
    return '', body


class _SafeMap(dict):
    """Tolerant of missing keys so a forgotten placeholder doesn't crash dispatch."""

    def __missing__(self, key):  # type: ignore[override]
        return ''


def _dispatch_one(
    *,
    channel: str,
    template_key: str,
    to: str,
    context: dict[str, Any],
    order=None,
    metadata: dict[str, Any] | None = None,
) -> Notification | None:
    if not to:
        # Don't bother creating a row for a missing address — clients with
        # neither email nor mobile produce no notifications.
        return None
    template = TEMPLATES.get(template_key)
    if template is None or not template.notify_client:
        return None

    subject, body = _render(template, channel, context)

    notification = Notification.objects.create(
        order=order,
        channel=channel,
        template_key=template_key,
        to_address=to,
        subject=subject,
        body=body,
        status=DeliveryStatus.PENDING,
        metadata=metadata or {},
    )

    provider = (
        get_email_provider() if channel == Channel.EMAIL else get_whatsapp_provider()
    )
    notification.provider = provider.name

    try:
        result = provider.send(to=to, subject=subject, body=body, metadata=metadata)
        if result.success:
            notification.status = DeliveryStatus.SENT
            notification.provider_message_id = result.message_id or ''
            notification.sent_at = timezone.now()
        else:
            notification.status = DeliveryStatus.FAILED
            notification.error = result.error or 'Provider returned no detail'
    except Exception as exc:  # pragma: no cover - extremely defensive
        logger.exception('Notification dispatch crashed')
        notification.status = DeliveryStatus.FAILED
        notification.error = str(exc)[:1000]

    notification.save(
        update_fields=['status', 'provider', 'provider_message_id', 'error', 'sent_at']
    )
    return notification


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def _notify_order(order, template_key: str) -> list[Notification]:
    template = TEMPLATES.get(template_key)
    if template is None or not template.notify_client:
        return []
    context = build_order_context(order)
    sent: list[Notification] = []
    if order.client.email:
        n = _dispatch_one(
            channel=Channel.EMAIL,
            template_key=template_key,
            to=order.client.email,
            context=context,
            order=order,
        )
        if n:
            sent.append(n)
    if order.client.mobile:
        n = _dispatch_one(
            channel=Channel.WHATSAPP,
            template_key=template_key,
            to=order.client.mobile,
            context=context,
            order=order,
        )
        if n:
            sent.append(n)
    return sent


def notify_order_created(order) -> list[Notification]:
    """Fired on order creation."""
    try:
        return _notify_order(order, 'order_received')
    except Exception:
        logger.exception('notify_order_created failed for %s', getattr(order, 'order_id', '?'))
        return []


def notify_order_status_changed(order, *, previous_status: str = '') -> list[Notification]:
    """Fired on status transition. No-ops for internal-only statuses."""
    template_key = STATUS_TEMPLATE_MAP.get(order.status)
    if not template_key:
        return []
    try:
        return _notify_order(order, template_key)
    except Exception:
        logger.exception(
            'notify_order_status_changed failed for %s', getattr(order, 'order_id', '?')
        )
        return []
