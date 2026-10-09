"""Order edits and cancellation. Every change is atomic, audited and broadcast."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.accounts.audit import record as audit_record
from apps.inventory.models import UsageKind
from apps.inventory.services import adjust_stock
from apps.realtime.broadcaster import order_status_changed as broadcast_status
from apps.realtime.broadcaster import order_updated as broadcast_updated

from .models import (
    GARMENT_EDITABLE_STATUSES,
    PRE_CUT_STATUSES,
    TERMINAL_STATUSES,
    Order,
    OrderLineItem,
    OrderStatus,
    OrderStatusEvent,
)

# Fields that may still change after delivery (settling the balance, a note).
POST_DELIVERY_FIELDS = {'advance', 'notes'}


def _return_fabric(order: Order, actor, note: str) -> None:
    for line in order.line_items.select_related('fabric'):
        if line.fabric_id and line.meters_used and line.meters_used > 0:
            adjust_stock(
                fabric_id=line.fabric_id,
                delta_meters=line.meters_used,
                kind=UsageKind.ADJUSTMENT,
                actor=actor,
                order=order,
                line_item=line,
                notes=note,
            )


def _deduct_fabric(order: Order, line: OrderLineItem, actor) -> None:
    if line.fabric_id and line.meters_used and line.meters_used > 0:
        adjust_stock(
            fabric_id=line.fabric_id,
            delta_meters=-line.meters_used,
            kind=UsageKind.ORDER,
            actor=actor,
            order=order,
            line_item=line,
            notes=f'Deducted on edit of order {order.order_id}',
        )


@transaction.atomic
def cancel_order(*, order: Order, actor, reason: str, return_fabric: bool | None = None) -> OrderStatusEvent:
    """Cancel an order that has not been delivered. `return_fabric` defaults to
    True only while the cloth has not been cut yet."""
    reason = (reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'Please say why the order is being cancelled.'})
    if order.status in TERMINAL_STATUSES:
        raise ValidationError(
            {'detail': 'A delivered order cannot be cancelled.' if order.status == OrderStatus.DELIVERED
             else 'This order is already cancelled.'}
        )

    previous = order.status
    if return_fabric is None:
        return_fabric = previous in PRE_CUT_STATUSES
    if return_fabric:
        _return_fabric(order, actor, f'Returned to stock: order {order.order_id} cancelled')

    order.status = OrderStatus.CANCELLED
    order.save(update_fields=['status', 'updated_at'])
    event = OrderStatusEvent.objects.create(
        order=order,
        from_status=previous,
        to_status=OrderStatus.CANCELLED,
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        reason=reason,
    )
    audit_record(
        'order_cancelled',
        actor=actor,
        metadata={
            'order_id': order.order_id,
            'from': previous,
            'reason': reason,
            'fabric_returned': bool(return_fabric),
        },
    )
    order.line_item_count = order.line_items.count()
    broadcast_status(order, previous_status=previous, actor=actor, reason=reason)
    return event


def _lines_total(lines: list[dict]) -> Decimal:
    return sum((Decimal(str(li.get('unit_price') or 0)) * int(li.get('quantity') or 1) for li in lines), Decimal('0'))


@transaction.atomic
def update_order(*, order: Order, actor, data: dict) -> Order:
    """Apply a validated edit. `data` may hold trial_date, delivery_date, advance, notes,
    measurement_set, order_type and (before cutting only) line_items."""
    if order.status == OrderStatus.CANCELLED:
        raise ValidationError({'detail': 'A cancelled order cannot be edited.'})

    allowed = set(data)
    if order.status == OrderStatus.DELIVERED:
        extra = allowed - POST_DELIVERY_FIELDS
        if extra:
            raise ValidationError(
                {'detail': f'A delivered order only allows changes to {", ".join(sorted(POST_DELIVERY_FIELDS))}.'}
            )
    elif order.status not in GARMENT_EDITABLE_STATUSES and ({'line_items', 'order_type'} & allowed):
        raise ValidationError(
            {'line_items': 'Garments can only be changed before cutting starts. '
                           'Cancel and re-create the order, or ask the master to proceed.'}
        )

    ms = data.get('measurement_set')
    if ms is not None and ms.client_id != order.client_id:
        raise ValidationError({'measurement_set': 'That measurement set belongs to a different client.'})

    changes: dict[str, list] = {}

    def note(field, old, new):
        if str(old) != str(new):
            changes[field] = [None if old is None else str(old), None if new is None else str(new)]

    new_lines = data.get('line_items')
    if new_lines is not None:
        if not new_lines:
            raise ValidationError({'line_items': 'At least one garment line item is required.'})
        old_total = order.subtotal
        _return_fabric(order, actor, f'Returned to stock: garments of order {order.order_id} edited')
        order.line_items.all().delete()
        for idx, item in enumerate(new_lines):
            line = OrderLineItem.objects.create(order=order, **{**item, 'position': idx})
            _deduct_fabric(order, line, actor)
        order.subtotal = _lines_total(new_lines)
        note('subtotal', old_total, order.subtotal)
        changes['line_items'] = [None, f'{len(new_lines)} line(s) replaced']

    for field in ('trial_date', 'delivery_date', 'advance', 'notes', 'order_type'):
        if field in data:
            note(field, getattr(order, field), data[field])
            setattr(order, field, data[field])
    if ms is not None or 'measurement_set' in data:
        note('measurement_set', order.measurement_set_id, ms.pk if ms else None)
        order.measurement_set = ms

    if order.advance > order.subtotal:
        raise ValidationError({'advance': 'The advance cannot be more than the order total.'})
    if order.advance < 0:
        raise ValidationError({'advance': 'The advance cannot be negative.'})

    if not changes:
        return order

    order.save()
    audit_record('order_edited', actor=actor, metadata={'order_id': order.order_id, 'changes': changes})
    order.line_item_count = order.line_items.count()
    broadcast_updated(order, actor=actor)
    return order
