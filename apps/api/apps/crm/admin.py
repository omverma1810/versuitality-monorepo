from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('client_id', 'full_name', 'mobile', 'email', 'created_at')
    search_fields = ('client_id', 'full_name', 'mobile', 'email')
    readonly_fields = ('client_id', 'created_at', 'updated_at')
    fieldsets = (
        (None, {'fields': ('client_id', 'full_name', 'mobile', 'alt_mobile', 'email')}),
        ('Profile', {'fields': ('address', 'age_group', 'occasion_preferences',
                                'fabric_preferences', 'notes', 'photo_url')}),
        ('Tracking', {'fields': ('created_by', 'created_at', 'updated_at')}),
    )
