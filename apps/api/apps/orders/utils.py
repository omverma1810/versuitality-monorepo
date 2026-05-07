"""Order ID generation: VS-YYYYMMDD-XXXX (XXXX is a 1-based daily counter).

Race-safe via SELECT ... FOR UPDATE on a per-day counter row.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone


def generate_order_id() -> str:
    from .models import OrderDailyCounter

    today = timezone.localdate()
    with transaction.atomic():
        counter, _ = OrderDailyCounter.objects.select_for_update().get_or_create(
            day=today,
        )
        counter.next_value += 1
        counter.save(update_fields=['next_value'])
        seq = counter.next_value
    return f'VS-{today.strftime("%Y%m%d")}-{seq:04d}'
