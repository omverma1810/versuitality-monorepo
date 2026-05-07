from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class QcOutcome(models.TextChoices):
    PASS = 'pass', 'Pass'
    FAIL = 'fail', 'Fail'


class QcInspection(models.Model):
    """A single QC pass over an order. Multiple inspections per order are
    allowed — when the master fixes a rejected garment and re-submits, the
    QA staff records a fresh inspection."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='qc_inspections',
    )
    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_inspections',
    )
    outcome = models.CharField(max_length=8, choices=QcOutcome.choices)

    # Checklist responses keyed by item key. Each entry:
    #   { "result": "pass" | "fail", "note": "..." }
    checklist = models.JSONField(default=dict)
    overall_comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['order', '-created_at'])]

    def __str__(self) -> str:
        return f'QC {self.outcome.upper()} · {self.order.order_id} @ {self.created_at:%Y-%m-%d}'

    @property
    def failed_items(self) -> list[str]:
        return [
            key
            for key, value in (self.checklist or {}).items()
            if isinstance(value, dict) and value.get('result') == 'fail'
        ]
