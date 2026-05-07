from __future__ import annotations

import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


GARMENT_TYPES = (
    'shirt',
    'kurta',
    'trouser',
    'pant',
    'suit',
    'blazer',
    'sherwani',
    'waistcoat',
    'jodhpuri',
)


class LapelStyle(models.TextChoices):
    NONE = '', '—'
    NOTCH = 'notch', 'Notch'
    PEAK = 'peak', 'Peak'
    SHAWL = 'shawl', 'Shawl'


class ButtonStance(models.TextChoices):
    NONE = '', '—'
    SINGLE_1 = 'single_1', 'Single — 1 button'
    SINGLE_2 = 'single_2', 'Single — 2 button'
    SINGLE_3 = 'single_3', 'Single — 3 button'
    DOUBLE_4 = 'double_4', 'Double-breasted — 4 button'
    DOUBLE_6 = 'double_6', 'Double-breasted — 6 button'


class VentStyle(models.TextChoices):
    NONE = '', '—'
    NO_VENT = 'no_vent', 'No vent'
    CENTER = 'center', 'Center vent'
    DOUBLE = 'double', 'Side vents'


def _measure() -> dict:
    """Decimal field args for half-inch precision body measurements."""
    return dict(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(120)],
    )


class MeasurementSet(models.Model):
    """A snapshot of a client's measurements captured during a single visit.

    Linked to a Client always, and (in Phase 3+) optionally to an Order.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        'crm.Client',
        on_delete=models.CASCADE,
        related_name='measurements',
    )
    # Order link is added later (Phase 3) — kept out for now to avoid
    # premature coupling.

    # Garment context for this measurement set.
    garment_types = models.JSONField(default=list, blank=True)
    garment_count = models.PositiveSmallIntegerField(default=1)

    # Upper body — shirt / kurta / blazer
    upper_length = models.DecimalField(**_measure())
    upper_shoulder = models.DecimalField(**_measure())
    upper_sleeve = models.DecimalField(**_measure())
    upper_half_sleeve = models.DecimalField(**_measure())
    upper_chest = models.DecimalField(**_measure())
    upper_waist = models.DecimalField(**_measure())
    upper_hip = models.DecimalField(**_measure())
    upper_cuff = models.DecimalField(**_measure())
    upper_collar = models.DecimalField(**_measure())
    upper_arms = models.DecimalField(**_measure())

    # Lower body — pant / trouser
    lower_length = models.DecimalField(**_measure())
    lower_bottom = models.DecimalField(**_measure())
    lower_knee = models.DecimalField(**_measure())
    lower_waist = models.DecimalField(**_measure())
    lower_hip = models.DecimalField(**_measure())
    lower_seat_round = models.DecimalField(**_measure())
    lower_inseam = models.DecimalField(**_measure())
    lower_thigh = models.DecimalField(**_measure())

    # Suit / blazer specifics
    suit_lapel_style = models.CharField(
        max_length=10, choices=LapelStyle.choices, blank=True, default=''
    )
    suit_button_stance = models.CharField(
        max_length=12, choices=ButtonStance.choices, blank=True, default=''
    )
    suit_vent = models.CharField(
        max_length=10, choices=VentStyle.choices, blank=True, default=''
    )

    # Fabric and notes
    cloth_image_url = models.URLField(blank=True)
    cloth_image = models.ImageField(upload_to='cloth/%Y/%m/', blank=True, null=True)
    fabric_details = models.TextField(blank=True)
    customization_notes = models.TextField(blank=True)

    # Provenance
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='measurements_taken',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['client', '-created_at'])]

    def __str__(self) -> str:
        return f'Measurements for {self.client.full_name} @ {self.created_at:%Y-%m-%d}'

    @property
    def visit_label(self) -> str:
        return self.created_at.strftime('%d %b %Y · %H:%M')
