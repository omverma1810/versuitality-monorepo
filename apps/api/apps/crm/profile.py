"""Everything the front desk needs when a returning customer walks in again:
latest measurements, recent orders (with their garments, for "repeat this order"),
and how long ago they were last measured."""
from __future__ import annotations

from django.utils import timezone

from apps.measurements.serializers import MeasurementSetSerializer
from apps.orders.models import OrderStatus
from apps.orders.serializers import OrderLineItemSerializer

RECENT_ORDERS = 3


def build_profile(client, *, context=None) -> dict:
    latest = client.measurements.order_by('-created_at').first()
    orders_qs = client.orders.exclude(status=OrderStatus.CANCELLED).order_by('-created_at')
    recent = list(orders_qs.prefetch_related('line_items')[:RECENT_ORDERS])
    last_order = recent[0] if recent else None

    now = timezone.now()
    last_visit = max((d for d in (latest.created_at if latest else None, last_order.created_at if last_order else None) if d), default=None)

    return {
        'latest_measurement': MeasurementSetSerializer(latest, context=context or {}).data if latest else None,
        'measurement_age_days': (now - latest.created_at).days if latest else None,
        'order_count': orders_qs.count(),
        'last_order_at': last_order.created_at if last_order else None,
        'last_visit_at': last_visit,
        'recent_orders': [
            {
                'id': str(o.id),
                'order_id': o.order_id,
                'status': o.status,
                'order_type': o.order_type,
                'created_at': o.created_at,
                'subtotal': str(o.subtotal),
                'garment_summary': o.garment_summary,
                'line_items': OrderLineItemSerializer(o.line_items.all(), many=True, context=context or {}).data,
            }
            for o in recent
        ],
    }
