from __future__ import annotations

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    order_code = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            'id',
            'order',
            'order_code',
            'channel',
            'template_key',
            'to_address',
            'subject',
            'body',
            'status',
            'provider',
            'provider_message_id',
            'error',
            'metadata',
            'created_at',
            'sent_at',
        )
        read_only_fields = fields

    def get_order_code(self, obj):
        return obj.order.order_id if obj.order_id else None
