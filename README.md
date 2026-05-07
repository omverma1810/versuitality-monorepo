# Versuitality

Internal operations platform for a premium men's bespoke tailoring house. Digitises the full lifecycle of a custom garment order — from client intake and body measurement capture, through production tracking and quality assurance, to final delivery — in one role-gated, real-time dashboard.

This is **not** a customer-facing app. It is an internal command centre for the store's team (Admin / Staff / Master / QA / Accountant).

## Brand

| Token | Value |
| --- | --- |
| Primary gold | `#CBA624` |
| Navy base | `#261F53` |
| Order ID format | `VS-YYYYMMDD-XXXX` |

## Tech stack

- **Web** — Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Shadcn/ui, Zustand, Framer Motion
- **API** — Django 5, Django REST Framework, Django Channels (WebSockets)
- **DB** — PostgreSQL 16
- **Cache / pub-sub** — Redis 7
- **Notifications** — SendGrid/Resend (email), Twilio (WhatsApp)
- **Exports** — ReportLab (PDF), openpyxl (Excel)

## Repo layout

```
versuitality-monorepo/
├── apps/
│   ├── web/          Next.js frontend (@versuitality/web)
│   └── api/          Django backend
├── packages/
│   ├── ui/           Shared component primitives (@versuitality/ui)
│   └── types/        Shared TypeScript types (@versuitality/types)
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Once everything is healthy:

- Web — http://localhost:3000
- API health — http://localhost:8000/api/health/
- Postgres — localhost:5432 (user/pass from `.env`)
- Redis — localhost:6379

## Local dev (without Docker)

Requires Node 20+, pnpm 9+, Python 3.12+, Postgres 16, Redis 7.

```bash
# Web
pnpm install
pnpm --filter @versuitality/web dev

# API
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

## Phase roadmap

| Phase | Scope |
| --- | --- |
| 0 | Monorepo scaffold, design tokens, placeholder login, `/api/health` |
| 1 | Auth & RBAC (Admin / Staff / Master / QA / Accountant) |
| 2 | CRM + measurement form (digital twin of paper slip) |
| 3 | Order lifecycle + PDF receipt |
| 4 | Real-time dashboard (Channels + WebSockets) |
| 5 | QA module + checklist |
| 6 | Notifications (Email + WhatsApp) |
| 7 | Inventory + appointments |
| 8 | Admin analytics |
| 9 | Polish + production cut |

Currently shipping: **Phase 0**.
