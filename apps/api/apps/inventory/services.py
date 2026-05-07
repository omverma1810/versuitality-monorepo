"""Stock movement service.

All stock changes go through ``adjust_stock`` so the running ledger
matches the cached `Fabric.quantity_meters` field. The function is wrapped
in an atomic transaction with a row-level lock to prevent two simultaneous
order creations from racing on the same fabric.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Fabric, FabricUsage, UsageKind


@transaction.atomic
def adjust_stock(
    *,
    fabric_id,
    delta_meters: Decimal,
    kind: str,
    actor=None,
    order=None,
    line_item=None,
    notes: str = '',
    allow_negative: bool = False,
) -> FabricUsage:
    """Apply a signed stock adjustment and write a ledger entry."""
    if delta_meters == 0:
        raise ValidationError({'delta_meters': 'Cannot record a zero-meter adjustment.'})
    if kind not in {c.value for c in UsageKind}:
        raise ValidationError({'kind': f'Invalid usage kind: {kind!r}.'})

    fabric = Fabric.objects.select_for_update().get(pk=fabric_id)
    new_qty = fabric.quantity_meters + Decimal(delta_meters)
    if new_qty < 0 and not allow_negative:
        raise ValidationError(
            {
                'delta_meters': (
                    f'Insufficient stock — only {fabric.quantity_meters} m '
                    f'remaining for {fabric.code}.'
                )
            }
        )
    fabric.quantity_meters = new_qty
    fabric.save(update_fields=['quantity_meters', 'updated_at'])

    return FabricUsage.objects.create(
        fabric=fabric,
        order=order,
        line_item=line_item,
        kind=kind,
        delta_meters=Decimal(delta_meters),
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        notes=notes,
    )
