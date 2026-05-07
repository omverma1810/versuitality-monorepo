from __future__ import annotations

import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class Role(models.TextChoices):
    ADMIN = 'admin', 'Admin (Owner)'
    STAFF = 'staff', 'Staff (Front Desk)'
    MASTER = 'master', 'Master (Head Tailor)'
    QA = 'qa', 'Quality Assurance'
    ACCOUNTANT = 'accountant', 'Accountant'


class User(AbstractBaseUser, PermissionsMixin):
    """Versuitality system user. Email is the login identifier."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=120)
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.STAFF,
        db_index=True,
    )
    phone = models.CharField(max_length=24, blank=True)
    avatar_url = models.URLField(blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    class Meta:
        ordering = ['full_name']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]

    def __str__(self) -> str:
        return f'{self.full_name} <{self.email}>'

    def get_full_name(self) -> str:
        return self.full_name

    def get_short_name(self) -> str:
        return self.full_name.split(' ', 1)[0] if self.full_name else self.email

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN or self.is_superuser


def _default_invite_expiry() -> timezone.datetime:
    return timezone.now() + timedelta(days=7)


def _generate_invite_token() -> str:
    return secrets.token_urlsafe(48)


class InviteToken(models.Model):
    """One-time setup token sent to newly invited users."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='invite',
    )
    token = models.CharField(
        max_length=128,
        unique=True,
        default=_generate_invite_token,
        editable=False,
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invites_sent',
    )
    expires_at = models.DateTimeField(default=_default_invite_expiry)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'Invite for {self.user.email}'

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_consumed and not self.is_expired

    def consume(self) -> None:
        self.consumed_at = timezone.now()
        self.save(update_fields=['consumed_at'])


class AuditAction(models.TextChoices):
    LOGIN = 'login', 'Login'
    LOGIN_FAILED = 'login_failed', 'Login failed'
    LOGOUT = 'logout', 'Logout'
    USER_INVITED = 'user_invited', 'User invited'
    USER_ACTIVATED = 'user_activated', 'User activated'
    USER_DEACTIVATED = 'user_deactivated', 'User deactivated'
    USER_ROLE_CHANGED = 'user_role_changed', 'User role changed'
    PASSWORD_SET = 'password_set', 'Password set'
    PASSWORD_RESET = 'password_reset', 'Password reset'


class AuditLog(models.Model):
    """Append-only record of significant actions. Admin-visible."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_actions',
    )
    action = models.CharField(max_length=40, choices=AuditAction.choices)
    target_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_targeted_by',
    )
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', 'created_at']),
        ]

    def __str__(self) -> str:
        actor = self.actor.email if self.actor else 'system'
        return f'{actor} · {self.action} @ {self.created_at:%Y-%m-%d %H:%M}'
