from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

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


class RoleMatrixPermission(BasePermission):
    """Server-side role enforcement declared on the view.

    A view sets:
      read_roles    roles allowed on safe methods (GET/HEAD/OPTIONS)
      write_roles   roles allowed on everything else
      action_roles  optional {action_name: roles} overriding the two above

    Admins (and superusers) always pass. Anything not listed is denied, so a new
    endpoint is closed by default until its roles are stated.
    """

    message = 'Your role does not have access to this resource.'

    def has_permission(self, request, view) -> bool:
        u = request.user
        if not (u and u.is_authenticated and u.is_active):
            return False
        if u.is_superuser or u.role == Role.ADMIN:
            return True
        action = getattr(view, 'action', None)
        overrides = getattr(view, 'action_roles', {})
        if action in overrides:
            roles = overrides[action]
        elif request.method in SAFE_METHODS:
            roles = getattr(view, 'read_roles', ())
        else:
            roles = getattr(view, 'write_roles', ())
        return u.role in roles
