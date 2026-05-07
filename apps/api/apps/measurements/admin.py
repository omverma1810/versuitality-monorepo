from django.contrib import admin

from .models import MeasurementSet


@admin.register(MeasurementSet)
class MeasurementSetAdmin(admin.ModelAdmin):
    list_display = ('client', 'created_at', 'garment_count', 'created_by')
    list_filter = ('created_at',)
    search_fields = ('client__full_name', 'client__client_id', 'client__mobile')
    readonly_fields = ('created_at',)
    autocomplete_fields = ('client',)
