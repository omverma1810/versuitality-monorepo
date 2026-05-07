from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class AppointmentKind(models.TextChoices):
    MEASUREMENT = 'measurement', 'Measurement'
    TRIAL = 'trial', 'Trial fitting'
    CONSULTATION = 'consultation', 'Consultation'
    DELIVERY = 'delivery', 'Delivery / pickup'
    OTHER = 'other', 'Other'


class AppointmentStatus(models.TextChoices):
    SCHEDULED = 'scheduled', 'Scheduled'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'
    NO_SHOW = 'no_show', 'No-show'


class NotifyVia(models.TextChoices):
    NONE = 'none', 'No reminder'
    EMAIL = 'email', 'Email only'
    WHATSAPP = 'whatsapp', 'WhatsApp only'
    BOTH = 'both', 'Email + WhatsApp'


class Appointment(models.Model):
    """A scheduled visit. Linked to a CRM client when one exists; otherwise the
    snapshot fields capture the prospect's contact info."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        'crm.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments',
    )

    # Snapshot fields — used when there is no CRM client yet, or kept in sync
    # so the appointment record survives client deletion.
    full_name = models.CharField(max_length=120)
    mobile = models.CharField(max_length=24, blank=True)
    email = models.EmailField(blank=True)

    scheduled_at = models.DateTimeField(db_index=True)
    duration_minutes = models.PositiveSmallIntegerField(default=30)
    kind = models.CharField(
        max_length=16,
        choices=AppointmentKind.choices,
        default=AppointmentKind.MEASUREMENT,
    )
    status = models.CharField(
        max_length=12,
        choices=AppointmentStatus.choices,
        default=AppointmentStatus.SCHEDULED,
        db_index=True,
    )

    notify_via = models.CharField(
        max_length=10,
        choices=NotifyVia.choices,
        default=NotifyVia.BOTH,
    )
    reminder_sent_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_at']
        indexes = [
            models.Index(fields=['status', 'scheduled_at']),
            models.Index(fields=['scheduled_at']),
        ]

    def __str__(self) -> str:
        return f'{self.full_name} · {self.kind} @ {self.scheduled_at:%Y-%m-%d %H:%M}'

    @property
    def ends_at(self):
        return self.scheduled_at + timezone.timedelta(minutes=self.duration_minutes)

    @property
    def is_upcoming(self) -> bool:
        return (
            self.status == AppointmentStatus.SCHEDULED
            and self.scheduled_at >= timezone.now()
        )
