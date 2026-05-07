from django.contrib import admin

from .models import QcInspection


@admin.register(QcInspection)
class QcInspectionAdmin(admin.ModelAdmin):
    list_display = ('order', 'outcome', 'inspector', 'created_at')
    list_filter = ('outcome', 'created_at')
    search_fields = ('order__order_id', 'order__client__full_name')
    readonly_fields = ('checklist', 'created_at')
    autocomplete_fields = ('order', 'inspector')
