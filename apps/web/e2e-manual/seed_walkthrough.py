"""Fictional team for the user-manual walkthrough (names and domain are made up).

Run from apps/api:  python manage.py shell < ../web/e2e-manual/seed_walkthrough.py
Reads WALKTHROUGH_PASSWORD from the environment.
"""
import os

from apps.accounts.models import Role, User

password = os.environ['WALKTHROUGH_PASSWORD']
TEAM = [
    ('admin@atelier.demo', 'Arjun Kapoor', Role.ADMIN),
    ('frontdesk@atelier.demo', 'Priya Nair', Role.STAFF),
    ('master@atelier.demo', 'Imran Qureshi', Role.MASTER),
    ('quality@atelier.demo', 'Neha Bhatt', Role.QA),
    ('accounts@atelier.demo', 'Vikram Rao', Role.ACCOUNTANT),
]
for email, name, role in TEAM:
    u, _ = User.objects.get_or_create(email=email, defaults={'full_name': name, 'role': role, 'is_active': True})
    u.full_name, u.role, u.is_active = name, role, True
    u.set_password(password)
    u.save()
print('walkthrough team ready')
