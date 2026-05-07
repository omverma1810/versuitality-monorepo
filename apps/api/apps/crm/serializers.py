from __future__ import annotations

from rest_framework import serializers

from .models import FABRIC_CHOICES, OCCASION_CHOICES, AgeGroup, Client
from .utils import normalise_mobile


def _validate_choice_list(values, allowed: tuple[str, ...]):
    if not isinstance(values, list):
        raise serializers.ValidationError('Expected a list of strings.')
    invalid = [v for v in values if v not in allowed]
    if invalid:
        raise serializers.ValidationError(f'Unknown values: {invalid!r}')
    return values


class ClientSerializer(serializers.ModelSerializer):
    last_measurement_at = serializers.DateTimeField(read_only=True, required=False)
    measurement_count = serializers.IntegerField(read_only=True, required=False)
    order_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Client
        fields = (
            'id',
            'client_id',
            'full_name',
            'mobile',
            'alt_mobile',
            'email',
            'address',
            'age_group',
            'occasion_preferences',
            'fabric_preferences',
            'notes',
            'photo_url',
            'created_at',
            'updated_at',
            'last_measurement_at',
            'measurement_count',
            'order_count',
        )
        read_only_fields = ('id', 'client_id', 'created_at', 'updated_at')

    def validate_mobile(self, value: str) -> str:
        value = normalise_mobile(value)
        if len(value.lstrip('+')) < 7:
            raise serializers.ValidationError('Please enter a valid mobile number.')
        qs = Client.objects.filter(mobile=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A client with this mobile number already exists.')
        return value

    def validate_alt_mobile(self, value: str) -> str:
        return normalise_mobile(value) if value else value

    def validate_age_group(self, value: str) -> str:
        if value and value not in {c.value for c in AgeGroup}:
            raise serializers.ValidationError('Invalid age group.')
        return value

    def validate_occasion_preferences(self, value):
        return _validate_choice_list(value, OCCASION_CHOICES)

    def validate_fabric_preferences(self, value):
        return _validate_choice_list(value, FABRIC_CHOICES)


class ClientSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer used by the global search dropdown."""

    class Meta:
        model = Client
        fields = (
            'id',
            'client_id',
            'full_name',
            'mobile',
            'email',
            'created_at',
        )
        read_only_fields = fields
