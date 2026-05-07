from django.contrib import admin

from .models import Fabric, FabricUsage


@admin.register(Fabric)
class FabricAdmin(admin.ModelAdmin):
    list_display = (
        'code',
        'name',
        'supplier',
        'color',
        'quantity_meters',
        'low_stock_threshold',
        'is_active',
    )
    list_filter = ('pattern', 'fabric_type', 'is_active')
    search_fields = ('code', 'name', 'supplier', 'color')
    readonly_fields = ('code', 'created_at', 'updated_at')


@admin.register(FabricUsage)
class FabricUsageAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'fabric', 'kind', 'delta_meters', 'order', 'actor')
    list_filter = ('kind',)
    search_fields = ('fabric__code', 'fabric__name', 'order__order_id')
    readonly_fields = ('created_at',)
