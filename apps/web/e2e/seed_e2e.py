"""Create one active user per role for the Playwright suite.

Run from apps/api:   python manage.py shell < ../web/e2e/seed_e2e.py
Reads E2E_PASSWORD from the environment; never hard-code credentials.
"""
import os

from apps.accounts.models import Role, User

password = os.environ['E2E_PASSWORD']
for role, name in [
    (Role.ADMIN, 'Anita Admin'),
    (Role.STAFF, 'Sanjay Staff'),
    (Role.MASTER, 'Mohan Master'),
    (Role.QA, 'Qadir Quality'),
    (Role.ACCOUNTANT, 'Asha Accounts'),
]:
    user, _ = User.objects.get_or_create(
        email=f'{role}@e2e.versuitality.test',
        defaults={'full_name': name, 'role': role, 'is_active': True},
    )
    user.full_name, user.role, user.is_active = name, role, True
    user.set_password(password)
    user.save()
print('e2e users ready')
