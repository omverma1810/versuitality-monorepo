from __future__ import annotations

import uuid

from django.db import models


class Channel(models.TextChoices):
    EMAIL = 'email', 'Email'
    WHATSAPP = 'whatsapp', 'WhatsApp'


class DeliveryStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SENT = 'sent', 'Sent'
    FAILED = 'failed', 'Failed'
    SKIPPED = 'skipped', 'Skipped'  # e.g. client has no email/mobile


class Notification(models.Model):
    """A single dispatch attempt to a recipient over a single channel.

    One real-world client status update typically produces two rows: one
    email, one WhatsApp. The pair is correlated via ``order`` + ``template_key``
    + ``created_at`` for the per-order log.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
    )

    channel = models.CharField(max_length=12, choices=Channel.choices)
    template_key = models.CharField(max_length=64)

    to_address = models.CharField(max_length=200)
    subject = models.CharField(max_length=240, blank=True)
    body = models.TextField()

    status = models.CharField(
        max_length=12,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
        db_index=True,
    )
    provider = models.CharField(max_length=64, blank=True)
    provider_message_id = models.CharField(max_length=200, blank=True)
    error = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', '-created_at']),
            models.Index(fields=['status', 'channel']),
        ]

    def __str__(self) -> str:
        order_id = self.order.order_id if self.order_id else '—'
        return f'{self.channel}:{self.template_key} → {self.to_address} ({order_id})'
