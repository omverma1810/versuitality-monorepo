from django.contrib import admin

from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        'scheduled_at',
        'full_name',
        'kind',
        'status',
        'mobile',
        'reminder_sent_at',
    )
    list_filter = ('kind', 'status', 'notify_via')
    search_fields = ('full_name', 'mobile', 'client__client_id')
    date_hierarchy = 'scheduled_at'
    readonly_fields = ('reminder_sent_at', 'created_at', 'updated_at')
    autocomplete_fields = ('client',)
