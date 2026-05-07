"""Signal hooks for audit logging."""
from __future__ import annotations

from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver

from .audit import AuditAction, record


@receiver(user_logged_in)
def _on_user_logged_in(sender, request, user, **kwargs):
    record(AuditAction.LOGIN, actor=user, request=request)


@receiver(user_login_failed)
def _on_user_login_failed(sender, credentials, request=None, **kwargs):
    record(
        AuditAction.LOGIN_FAILED,
        request=request,
        metadata={'email': credentials.get('email') or credentials.get('username')},
    )
