from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.crm.serializers import ClientSummarySerializer

from .models import (
    OrderLineItem,
    OrderStatus,
    OrderStatusEvent,
    OrderType,
    Order,
    PRODUCTION_FLOW,
    ALLOWED_TRANSITIONS,
)


class OrderLineItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    fabric_code = serializers.CharField(source='fabric.code', read_only=True)
    fabric_name = serializers.CharField(source='fabric.name', read_only=True)

    class Meta:
        model = OrderLineItem
        fields = (
            'id',
            'garment_type',
            'fabric_description',
            'fabric',
            'fabric_code',
            'fabric_name',
            'meters_used',
            'quantity',
            'unit_price',
            'customization_notes',
            'position',
            'line_total',
        )
        read_only_fields = ('id', 'line_total', 'fabric_code', 'fabric_name')


class OrderStatusEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusEvent
        fields = (
            'id',
            'from_status',
            'to_status',
            'actor',
            'actor_name',
            'actor_role',
            'reason',
            'created_at',
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor_id else 'System'

    def get_actor_role(self, obj):
        return obj.actor.role if obj.actor_id else None


class OrderListSerializer(serializers.ModelSerializer):
    client = ClientSummarySerializer(read_only=True)
    garment_summary = serializers.CharField(read_only=True)
    line_item_count = serializers.IntegerField(read_only=True, required=False)
    days_since_creation = serializers.SerializerMethodField()
    balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    next_statuses = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id',
            'order_id',
            'client',
            'order_type',
            'status',
            'trial_date',
            'delivery_date',
            'delivered_at',
            'subtotal',
            'advance',
            'balance',
            'notes',
            'garment_summary',
            'line_item_count',
            'days_since_creation',
            'next_statuses',
            'created_at',
            'updated_at',
        )

    def get_days_since_creation(self, obj):
        from django.utils import timezone

        return (timezone.now() - obj.created_at).days

    def get_next_statuses(self, obj):
        return sorted(ALLOWED_TRANSITIONS.get(obj.status, set()))


class OrderDetailSerializer(OrderListSerializer):
    line_items = OrderLineItemSerializer(many=True, read_only=True)
    status_events = OrderStatusEventSerializer(many=True, read_only=True)
    measurement_set = serializers.UUIDField(read_only=True)

    class Meta(OrderListSerializer.Meta):
        fields = OrderListSerializer.Meta.fields + (
            'line_items',
            'status_events',
            'measurement_set',
        )


class OrderCreateSerializer(serializers.ModelSerializer):
    line_items = OrderLineItemSerializer(many=True)

    class Meta:
        model = Order
        fields = (
            'client',
            'measurement_set',
            'order_type',
            'trial_date',
            'delivery_date',
            'subtotal',
            'advance',
            'notes',
            'line_items',
        )

    def validate_order_type(self, value):
        if value not in {c.value for c in OrderType}:
            raise serializers.ValidationError('Invalid order type.')
        return value

    def validate(self, attrs):
        line_items = attrs.get('line_items') or []
        if not line_items:
            raise serializers.ValidationError(
                {'line_items': 'At least one garment line item is required.'}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from apps.inventory.services import adjust_stock
        from apps.inventory.models import UsageKind

        items = validated_data.pop('line_items')
        order = Order.objects.create(**validated_data)
        actor = self.context['request'].user if 'request' in self.context else None

        for idx, item in enumerate(items):
            line = OrderLineItem.objects.create(order=order, position=idx, **item)
            # Auto-deduct fabric stock when both the bolt and a meter count are
            # supplied. Failures (insufficient stock) bubble up via the atomic
            # transaction so the entire order create rolls back cleanly.
            if line.fabric_id and line.meters_used and line.meters_used > 0:
                adjust_stock(
                    fabric_id=line.fabric_id,
                    delta_meters=-line.meters_used,
                    kind=UsageKind.ORDER,
                    actor=actor,
                    order=order,
                    line_item=line,
                    notes=f'Auto-deducted on order {order.order_id} creation',
                )

        if not order.subtotal or order.subtotal == Decimal('0'):
            # Auto-roll-up if the staff didn't set a subtotal.
            total = sum(
                (li.unit_price * li.quantity for li in order.line_items.all()),
                start=Decimal('0'),
            )
            if total:
                order.subtotal = total
                order.save(update_fields=['subtotal'])

        # Seed the timeline with the initial status.
        OrderStatusEvent.objects.create(
            order=order,
            from_status='',
            to_status=order.status,
            actor=self.context['request'].user
            if 'request' in self.context
            else None,
        )
        return order


class OrderTransitionSerializer(serializers.Serializer):
    target = serializers.ChoiceField(choices=OrderStatus.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default='')


__all__ = [
    'OrderListSerializer',
    'OrderDetailSerializer',
    'OrderCreateSerializer',
    'OrderTransitionSerializer',
    'OrderLineItemSerializer',
    'OrderStatusEventSerializer',
    'PRODUCTION_FLOW',
]
