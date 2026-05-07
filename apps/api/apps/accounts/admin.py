from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AuditLog, InviteToken, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ('email',)
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_superuser', 'last_login')
    list_filter = ('role', 'is_active', 'is_superuser')
    search_fields = ('email', 'full_name')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('full_name', 'role', 'phone', 'avatar_url')}),
        ('Status', {'fields': ('is_active', 'is_staff', 'is_superuser', 'last_login_ip')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    readonly_fields = ('last_login', 'created_at', 'updated_at', 'last_login_ip')
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'role', 'password1', 'password2', 'is_active'),
        }),
    )


@admin.register(InviteToken)
class InviteTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'expires_at', 'consumed_at', 'created_at')
    list_filter = ('consumed_at',)
    search_fields = ('user__email',)
    readonly_fields = ('token', 'created_at')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'action', 'actor', 'target_user', 'ip_address')
    list_filter = ('action', 'created_at')
    search_fields = ('actor__email', 'target_user__email')
    readonly_fields = (
        'actor',
        'action',
        'target_user',
        'metadata',
        'ip_address',
        'user_agent',
        'created_at',
    )
    date_hierarchy = 'created_at'
