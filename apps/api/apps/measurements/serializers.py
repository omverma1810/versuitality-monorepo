from __future__ import annotations

import json

from rest_framework import serializers

from .models import GARMENT_TYPES, MeasurementSet


def _validate_garments(values):
    if not isinstance(values, list):
        raise serializers.ValidationError('Expected a list of strings.')
    invalid = [v for v in values if v not in GARMENT_TYPES]
    if invalid:
        raise serializers.ValidationError(f'Unknown garment types: {invalid!r}')
    return values


class MeasurementSetSerializer(serializers.ModelSerializer):
    visit_label = serializers.CharField(read_only=True)
    cloth_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = MeasurementSet
        fields = (
            'id',
            'client',
            'visit_label',
            'garment_types',
            'garment_count',
            # Upper
            'upper_length',
            'upper_shoulder',
            'upper_sleeve',
            'upper_half_sleeve',
            'upper_chest',
            'upper_waist',
            'upper_hip',
            'upper_cuff',
            'upper_collar',
            'upper_arms',
            # Lower
            'lower_length',
            'lower_bottom',
            'lower_knee',
            'lower_waist',
            'lower_hip',
            'lower_seat_round',
            'lower_inseam',
            'lower_thigh',
            # Suit
            'suit_lapel_style',
            'suit_button_stance',
            'suit_vent',
            # Fabric
            'cloth_image_url',
            'cloth_image',
            'fabric_details',
            'customization_notes',
            'created_at',
            'created_by',
        )
        read_only_fields = ('id', 'created_at', 'created_by', 'visit_label')

    def validate_garment_types(self, value):
        return _validate_garments(value)

    def to_internal_value(self, data):
        # Multipart submissions encode list fields as JSON strings.
        if hasattr(data, 'getlist'):
            data = data.dict()
        gt = data.get('garment_types') if isinstance(data, dict) else None
        if isinstance(gt, str):
            try:
                parsed = json.loads(gt)
                if isinstance(parsed, list):
                    data = {**data, 'garment_types': parsed}
            except json.JSONDecodeError:
                pass
        return super().to_internal_value(data)
