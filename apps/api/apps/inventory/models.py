from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from .utils import generate_fabric_code


class FabricPattern(models.TextChoices):
    SOLID = 'solid', 'Solid'
    STRIPE = 'stripe', 'Stripe'
    CHECK = 'check', 'Check'
    PRINT = 'print', 'Print'
    TEXTURED = 'textured', 'Textured'
    OTHER = 'other', 'Other'


def _unique_fabric_code() -> str:
    while True:
        candidate = generate_fabric_code()
        if not Fabric.objects.filter(code=candidate).exists():
            return candidate


class Fabric(models.Model):
    """A single fabric bolt (or roll) tracked in inches/meters of stock."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True, editable=False, db_index=True)

    name = models.CharField(max_length=200)
    supplier = models.CharField(max_length=200, blank=True)
    color = models.CharField(max_length=80, blank=True)
    pattern = models.CharField(
        max_length=16, choices=FabricPattern.choices, default=FabricPattern.SOLID
    )
    fabric_type = models.CharField(max_length=40, blank=True)  # cotton / wool / etc.

    quantity_meters = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
    )
    low_stock_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('5'),
        validators=[MinValueValidator(Decimal('0'))],
    )
    cost_per_meter = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    price_per_meter = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))

    notes = models.TextField(blank=True)
    image_url = models.URLField(blank=True)

    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fabrics_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['supplier']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self) -> str:
        return f'{self.code} · {self.name}'

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = _unique_fabric_code()
        super().save(*args, **kwargs)

    @property
    def is_low_stock(self) -> bool:
        return self.quantity_meters <= self.low_stock_threshold

    @property
    def stock_value(self) -> Decimal:
        return (self.quantity_meters or Decimal('0')) * (
            self.cost_per_meter or Decimal('0')
        )


class UsageKind(models.TextChoices):
    ORDER = 'order', 'Order consumption'
    RESTOCK = 'restock', 'Restock'
    WASTAGE = 'wastage', 'Wastage'
    SAMPLE = 'sample', 'Sample'
    ADJUSTMENT = 'adjustment', 'Manual adjustment'


class FabricUsage(models.Model):
    """Signed ledger of stock movements. Positive `delta_meters` is inflow,
    negative is consumption. Aggregated, the running sum equals the current
    fabric stock — a simple audit / reconciliation primitive."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fabric = models.ForeignKey(
        Fabric,
        on_delete=models.CASCADE,
        related_name='usage_events',
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fabric_usage',
    )
    line_item = models.ForeignKey(
        'orders.OrderLineItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fabric_usage',
    )

    kind = models.CharField(max_length=16, choices=UsageKind.choices)
    delta_meters = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fabric_usage_actions',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['fabric', '-created_at'])]

    def __str__(self) -> str:
        sign = '+' if self.delta_meters > 0 else ''
        return f'{self.fabric.code} {sign}{self.delta_meters}m ({self.kind})'
