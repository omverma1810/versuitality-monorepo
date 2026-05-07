"""Helpers for capturing audit-trail context from incoming requests."""
from __future__ import annotations

from typing import Any

from .models import AuditAction, AuditLog


def _client_ip(request) -> str | None:
    if not request:
        return None
    fwd = request.META.get('HTTP_X_FORWARDED_FOR')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _user_agent(request) -> str:
    if not request:
        return ''
    return request.META.get('HTTP_USER_AGENT', '')[:400]


def record(
    action: str,
    *,
    actor=None,
    target_user=None,
    request=None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    return AuditLog.objects.create(
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        action=action,
        target_user=target_user,
        metadata=metadata or {},
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )


__all__ = ['record', 'AuditAction']
