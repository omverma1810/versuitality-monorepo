"""Role-aware order status transitions."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.audit import record as audit_record
from apps.accounts.models import Role

from .models import (
    ALLOWED_TRANSITIONS,
    REQUIRES_REASON,
    Order,
    OrderStatus,
    OrderStatusEvent,
)


# Which roles are allowed to drive each transition (admin always allowed).
TRANSITION_ROLES: dict[tuple[str, str], set[str]] = {
    (OrderStatus.ORDER_RECEIVED, OrderStatus.REQUIREMENTS_NOTED): {Role.MASTER, Role.STAFF},
    (OrderStatus.REQUIREMENTS_NOTED, OrderStatus.CUTTING_STARTED): {Role.MASTER},
    (OrderStatus.CUTTING_STARTED, OrderStatus.STITCHING_IN_PROGRESS): {Role.MASTER},
    (OrderStatus.STITCHING_IN_PROGRESS, OrderStatus.READY_FOR_TRIAL): {Role.MASTER},
    (OrderStatus.READY_FOR_TRIAL, OrderStatus.ALTERATION_IN_PROGRESS): {Role.MASTER, Role.STAFF},
    (OrderStatus.READY_FOR_TRIAL, OrderStatus.READY_FOR_QC): {Role.MASTER},
    (OrderStatus.ALTERATION_IN_PROGRESS, OrderStatus.READY_FOR_QC): {Role.MASTER},
    (OrderStatus.READY_FOR_QC, OrderStatus.READY_FOR_DELIVERY): {Role.QA},
    (OrderStatus.READY_FOR_QC, OrderStatus.QC_REJECTED): {Role.QA},
    (OrderStatus.QC_REJECTED, OrderStatus.STITCHING_IN_PROGRESS): {Role.MASTER},
    (OrderStatus.QC_REJECTED, OrderStatus.ALTERATION_IN_PROGRESS): {Role.MASTER},
    (OrderStatus.QC_REJECTED, OrderStatus.READY_FOR_QC): {Role.MASTER},
    (OrderStatus.READY_FOR_DELIVERY, OrderStatus.DELIVERED): {Role.STAFF},
}


def can_transition(user, current: str, target: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.role == Role.ADMIN:
        return True
    if target not in ALLOWED_TRANSITIONS.get(current, set()):
        return False
    allowed = TRANSITION_ROLES.get((current, target), set())
    return user.role in allowed


@transaction.atomic
def transition_order(*, order: Order, target: str, actor, reason: str = '') -> OrderStatusEvent:
    if order.status == target:
        raise ValidationError({'detail': 'Order is already in this status.'})

    if target not in ALLOWED_TRANSITIONS.get(order.status, set()):
        # Admins may force-set any status, including non-adjacent.
        if not (actor and (actor.is_superuser or actor.role == Role.ADMIN)):
            raise ValidationError(
                {
                    'detail': (
                        f'Transition {order.status} → {target} is not allowed. '
                        'Reach the target status by following the production flow.'
                    )
                }
            )

    if not can_transition(actor, order.status, target):
        raise PermissionDenied('Your role cannot perform this transition.')

    if target in REQUIRES_REASON and not reason.strip():
        raise ValidationError({'reason': 'A reason is required for this transition.'})

    previous = order.status
    order.status = target
    if target == OrderStatus.DELIVERED:
        order.delivered_at = timezone.now()
    order.save(update_fields=['status', 'delivered_at', 'updated_at'])

    event = OrderStatusEvent.objects.create(
        order=order,
        from_status=previous,
        to_status=target,
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        reason=reason.strip(),
    )

    audit_record(
        'order_status_changed',
        actor=actor,
        metadata={
            'order_id': order.order_id,
            'from': previous,
            'to': target,
            'reason': reason,
        },
    )
    return event
