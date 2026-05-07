"""Custom user manager — email is the login identifier, no usernames."""
from __future__ import annotations

from django.contrib.auth.base_user import BaseUserManager
from django.db import transaction


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra):
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email: str, password: str, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('role', 'admin')
        if not extra.get('is_staff'):
            raise ValueError('Superuser must have is_staff=True.')
        if not extra.get('is_superuser'):
            raise ValueError('Superuser must have is_superuser=True.')
        return self._create_user(email, password, **extra)

    @transaction.atomic
    def invite(self, *, email: str, full_name: str, role: str, invited_by=None):
        """Create an inactive user + a one-time invite token."""
        from .models import InviteToken

        user = self.create_user(
            email=email,
            full_name=full_name,
            role=role,
            is_active=False,
        )
        invite = InviteToken.objects.create(user=user, invited_by=invited_by)
        return user, invite
