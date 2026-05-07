"""Server-side helpers for publishing order events to the WS group.

Synchronous façade over the channel layer so the rest of the codebase can
drop in a one-liner without thinking about async.
"""
from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from .consumers import ORDER_BOARD_GROUP

logger = logging.getLogger(__name__)


def _send(payload: dict[str, Any]) -> None:
    layer = get_channel_layer()
    if layer is None:  # pragma: no cover - misconfigured envs
        return
    try:
        async_to_sync(layer.group_send)(
            ORDER_BOARD_GROUP,
            {'type': 'order.event', 'payload': payload},
        )
    except Exception:  # pragma: no cover - best-effort overlay on HTTP API
        logger.warning('Failed to broadcast order event', exc_info=True)


def _serialize_order(order) -> dict[str, Any]:
    # Lazy import to avoid circular dependency at module load.
    from apps.orders.serializers import OrderListSerializer

    return OrderListSerializer(order).data


def _actor_payload(actor) -> dict[str, Any] | None:
    if not actor or not getattr(actor, 'is_authenticated', False):
        return None
    return {
        'id': str(actor.id),
        'full_name': actor.full_name,
        'role': actor.role,
    }


def order_created(order, *, actor=None) -> None:
    _send(
        {
            'kind': 'order_created',
            'order': _serialize_order(order),
            'actor': _actor_payload(actor),
            'at': timezone.now().isoformat(),
        }
    )


def order_status_changed(
    order, *, previous_status: str, actor=None, reason: str = ''
) -> None:
    _send(
        {
            'kind': 'order_status_changed',
            'order': _serialize_order(order),
            'previous_status': previous_status,
            'actor': _actor_payload(actor),
            'reason': reason,
            'at': timezone.now().isoformat(),
        }
    )


def order_updated(order, *, actor=None) -> None:
    _send(
        {
            'kind': 'order_updated',
            'order': _serialize_order(order),
            'actor': _actor_payload(actor),
            'at': timezone.now().isoformat(),
        }
    )
