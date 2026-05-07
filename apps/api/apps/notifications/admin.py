from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'created_at',
        'channel',
        'template_key',
        'to_address',
        'status',
        'provider',
        'order',
    )
    list_filter = ('channel', 'status', 'template_key', 'provider')
    search_fields = ('to_address', 'order__order_id', 'provider_message_id')
    readonly_fields = (
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
        'order',
    )
    date_hierarchy = 'created_at'
