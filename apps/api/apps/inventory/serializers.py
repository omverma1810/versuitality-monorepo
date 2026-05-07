from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import Fabric, FabricUsage, UsageKind


class FabricSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Fabric
        fields = (
            'id',
            'code',
            'name',
            'supplier',
            'color',
            'pattern',
            'fabric_type',
            'quantity_meters',
            'low_stock_threshold',
            'cost_per_meter',
            'price_per_meter',
            'notes',
            'image_url',
            'is_active',
            'is_low_stock',
            'stock_value',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'code', 'created_at', 'updated_at')


class FabricUsageSerializer(serializers.ModelSerializer):
    fabric_code = serializers.CharField(source='fabric.code', read_only=True)
    fabric_name = serializers.CharField(source='fabric.name', read_only=True)
    actor_name = serializers.SerializerMethodField()
    order_code = serializers.SerializerMethodField()

    class Meta:
        model = FabricUsage
        fields = (
            'id',
            'fabric',
            'fabric_code',
            'fabric_name',
            'order',
            'order_code',
            'line_item',
            'kind',
            'delta_meters',
            'notes',
            'actor',
            'actor_name',
            'created_at',
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor_id else 'System'

    def get_order_code(self, obj):
        return obj.order.order_id if obj.order_id else None


class FabricAdjustSerializer(serializers.Serializer):
    """Manual adjustment endpoint payload — restock, wastage, or correction."""

    delta_meters = serializers.DecimalField(max_digits=10, decimal_places=2)
    kind = serializers.ChoiceField(choices=UsageKind.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_delta_meters(self, value):
        if value == Decimal('0'):
            raise serializers.ValidationError('Use a non-zero value.')
        return value
