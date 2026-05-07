# Versuitality API

Django 5 + DRF backend for Versuitality.

## Phase 0 endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health/` | Liveness probe |

## Local dev

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SECRET_KEY=dev DJANGO_DEBUG=1
export POSTGRES_HOST=localhost POSTGRES_USER=versuitality POSTGRES_PASSWORD=versuitality_dev POSTGRES_DB=versuitality
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

## Layout

```
apps/api/
├── manage.py
├── requirements.txt
├── versuitality/        Django project (settings, urls, wsgi, asgi)
└── apps/                Domain apps live here
    └── core/            Phase 0 health + shared utilities
```

Domain apps added in subsequent phases:

- `accounts` — users, roles, RBAC (Phase 1)
- `crm` — clients, search (Phase 2)
- `measurements` — measurement sets (Phase 2)
- `orders` — order lifecycle, status, PDF (Phase 3)
- `realtime` — Channels consumers (Phase 4)
- `qa` — quality checklist (Phase 5)
- `notifications` — email + WhatsApp dispatch (Phase 6)
- `inventory` — fabric stock (Phase 7)
- `analytics` — admin dashboard data (Phase 8)
