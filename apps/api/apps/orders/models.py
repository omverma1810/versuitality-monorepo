from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from .utils import generate_order_id


class OrderType(models.TextChoices):
    FULL = 'full', 'Full bespoke order'
    ALTERATION = 'alteration', 'Alteration only'


class OrderStatus(models.TextChoices):
    ORDER_RECEIVED = 'order_received', 'Order received'
    REQUIREMENTS_NOTED = 'requirements_noted', 'Requirements noted'
    CUTTING_STARTED = 'cutting_started', 'Cutting started'
    STITCHING_IN_PROGRESS = 'stitching_in_progress', 'Stitching in progress'
    READY_FOR_TRIAL = 'ready_for_trial', 'Ready for trial'
    ALTERATION_IN_PROGRESS = 'alteration_in_progress', 'Alteration in progress'
    READY_FOR_QC = 'ready_for_qc', 'Ready for QC'
    QC_REJECTED = 'qc_rejected', 'QC rejected — rework'
    READY_FOR_DELIVERY = 'ready_for_delivery', 'Ready for delivery'
    DELIVERED = 'delivered', 'Delivered'


# Allowed forward transitions for non-admin roles.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    OrderStatus.ORDER_RECEIVED: {OrderStatus.REQUIREMENTS_NOTED},
    OrderStatus.REQUIREMENTS_NOTED: {OrderStatus.CUTTING_STARTED},
    OrderStatus.CUTTING_STARTED: {OrderStatus.STITCHING_IN_PROGRESS},
    OrderStatus.STITCHING_IN_PROGRESS: {OrderStatus.READY_FOR_TRIAL},
    OrderStatus.READY_FOR_TRIAL: {
        OrderStatus.ALTERATION_IN_PROGRESS,
        OrderStatus.READY_FOR_QC,
    },
    OrderStatus.ALTERATION_IN_PROGRESS: {OrderStatus.READY_FOR_QC},
    OrderStatus.READY_FOR_QC: {
        OrderStatus.READY_FOR_DELIVERY,
        OrderStatus.QC_REJECTED,
    },
    OrderStatus.QC_REJECTED: {
        OrderStatus.STITCHING_IN_PROGRESS,
        OrderStatus.ALTERATION_IN_PROGRESS,
        OrderStatus.READY_FOR_QC,
    },
    OrderStatus.READY_FOR_DELIVERY: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
}


# Statuses that require the actor to provide a reason / comment.
REQUIRES_REASON = {OrderStatus.QC_REJECTED}


# Phase weighting for "days per stage" funnel analytics.
PRODUCTION_FLOW = [
    OrderStatus.ORDER_RECEIVED,
    OrderStatus.REQUIREMENTS_NOTED,
    OrderStatus.CUTTING_STARTED,
    OrderStatus.STITCHING_IN_PROGRESS,
    OrderStatus.READY_FOR_TRIAL,
    OrderStatus.ALTERATION_IN_PROGRESS,
    OrderStatus.READY_FOR_QC,
    OrderStatus.READY_FOR_DELIVERY,
    OrderStatus.DELIVERED,
]


class OrderDailyCounter(models.Model):
    """One row per calendar day. Used to atomically derive the daily sequence."""

    day = models.DateField(primary_key=True)
    next_value = models.IntegerField(default=0)


class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_id = models.CharField(
        max_length=24,
        unique=True,
        editable=False,
        db_index=True,
    )

    client = models.ForeignKey(
        'crm.Client',
        on_delete=models.PROTECT,
        related_name='orders',
    )
    measurement_set = models.ForeignKey(
        'measurements.MeasurementSet',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )

    order_type = models.CharField(
        max_length=16,
        choices=OrderType.choices,
        default=OrderType.FULL,
    )
    status = models.CharField(
        max_length=32,
        choices=OrderStatus.choices,
        default=OrderStatus.ORDER_RECEIVED,
        db_index=True,
    )

    trial_date = models.DateField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    advance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['client', '-created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.order_id} · {self.client.full_name}'

    def save(self, *args, **kwargs):
        if not self.order_id:
            self.order_id = generate_order_id()
        super().save(*args, **kwargs)

    @property
    def balance(self) -> Decimal:
        return (self.subtotal or Decimal('0')) - (self.advance or Decimal('0'))

    @property
    def garment_summary(self) -> str:
        return ', '.join(li.garment_label_with_qty() for li in self.line_items.all())


class OrderLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='line_items',
    )
    garment_type = models.CharField(max_length=24)
    fabric_description = models.CharField(max_length=200, blank=True)
    fabric = models.ForeignKey(
        'inventory.Fabric',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_line_items',
    )
    meters_used = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal('0')
    )
    quantity = models.PositiveSmallIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    customization_notes = models.TextField(blank=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']

    def garment_label_with_qty(self) -> str:
        if self.quantity > 1:
            return f'{self.quantity} × {self.garment_type}'
        return self.garment_type

    @property
    def line_total(self) -> Decimal:
        return (self.unit_price or Decimal('0')) * self.quantity


class OrderStatusEvent(models.Model):
    """Append-only log of status transitions for an order."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='status_events',
    )
    from_status = models.CharField(max_length=32, blank=True)
    to_status = models.CharField(max_length=32, choices=OrderStatus.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='status_events',
    )
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self) -> str:
        return f'{self.order.order_id}: {self.from_status or "—"} → {self.to_status}'
