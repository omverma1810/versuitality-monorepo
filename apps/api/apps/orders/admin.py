from django.contrib import admin

from .models import Order, OrderLineItem, OrderStatusEvent


class LineItemInline(admin.TabularInline):
    model = OrderLineItem
    extra = 0


class StatusEventInline(admin.TabularInline):
    model = OrderStatusEvent
    extra = 0
    readonly_fields = ('from_status', 'to_status', 'actor', 'reason', 'created_at')
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'client', 'order_type', 'status', 'subtotal', 'created_at')
    list_filter = ('status', 'order_type', 'created_at')
    search_fields = ('order_id', 'client__full_name', 'client__mobile', 'client__client_id')
    readonly_fields = ('order_id', 'created_at', 'updated_at', 'delivered_at')
    inlines = [LineItemInline, StatusEventInline]
    autocomplete_fields = ('client', 'measurement_set')


@admin.register(OrderStatusEvent)
class OrderStatusEventAdmin(admin.ModelAdmin):
    list_display = ('order', 'from_status', 'to_status', 'actor', 'created_at')
    list_filter = ('to_status',)
    search_fields = ('order__order_id',)
