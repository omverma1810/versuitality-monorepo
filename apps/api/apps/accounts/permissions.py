from __future__ import annotations

from rest_framework.permissions import BasePermission

from .models import Role


class IsAuthenticatedActive(BasePermission):
    message = 'Authentication required.'

    def has_permission(self, request, view) -> bool:
        u = request.user
        return bool(u and u.is_authenticated and u.is_active)


class _RolePermission(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view) -> bool:
        u = request.user
        if not (u and u.is_authenticated and u.is_active):
            return False
        if u.is_superuser:
            return True
        return u.role in self.allowed_roles


class IsAdmin(_RolePermission):
    allowed_roles = (Role.ADMIN,)
    message = 'Admin role required.'


class IsStaff(_RolePermission):
    allowed_roles = (Role.STAFF, Role.ADMIN)


class IsMaster(_RolePermission):
    allowed_roles = (Role.MASTER, Role.ADMIN)


class IsQA(_RolePermission):
    allowed_roles = (Role.QA, Role.ADMIN)


class IsAccountant(_RolePermission):
    allowed_roles = (Role.ACCOUNTANT, Role.ADMIN)
