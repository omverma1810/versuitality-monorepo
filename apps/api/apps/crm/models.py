from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from .utils import generate_client_id, normalise_mobile


class AgeGroup(models.TextChoices):
    UNDER_25 = 'under_25', 'Under 25'
    A_25_34 = '25_34', '25 – 34'
    A_35_44 = '35_44', '35 – 44'
    A_45_54 = '45_54', '45 – 54'
    A_55_PLUS = '55_plus', '55+'


OCCASION_CHOICES = (
    'wedding',
    'formal',
    'business',
    'casual',
    'festive',
    'ethnic',
)

FABRIC_CHOICES = (
    'cotton',
    'linen',
    'wool',
    'silk',
    'polyester_blend',
    'denim',
    'velvet',
    'tweed',
)


def _unique_client_id() -> str:
    # In the unlikely event of a collision, retry. The keyspace is ~33^6 (~1.3B).
    while True:
        candidate = generate_client_id()
        if not Client.objects.filter(client_id=candidate).exists():
            return candidate


class Client(models.Model):
    """A walk-in customer of the Versuitality store."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_id = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        db_index=True,
    )

    full_name = models.CharField(max_length=120, db_index=True)
    mobile = models.CharField(max_length=24, unique=True, db_index=True)
    alt_mobile = models.CharField(max_length=24, blank=True)
    email = models.EmailField(blank=True, db_index=True)

    address = models.TextField(blank=True)
    age_group = models.CharField(
        max_length=16,
        choices=AgeGroup.choices,
        blank=True,
    )

    # Loose-typed string lists chosen from OCCASION_CHOICES / FABRIC_CHOICES so
    # the staff UI can iterate without requiring schema changes for new tags.
    occasion_preferences = models.JSONField(default=list, blank=True)
    fabric_preferences = models.JSONField(default=list, blank=True)

    notes = models.TextField(blank=True)
    photo_url = models.URLField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clients_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['full_name']),
            models.Index(fields=['mobile']),
        ]

    def __str__(self) -> str:
        return f'{self.full_name} · {self.client_id}'

    def save(self, *args, **kwargs):
        if not self.client_id:
            self.client_id = _unique_client_id()
        if self.mobile:
            self.mobile = normalise_mobile(self.mobile)
        if self.alt_mobile:
            self.alt_mobile = normalise_mobile(self.alt_mobile)
        super().save(*args, **kwargs)
