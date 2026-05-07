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
- Django admin — http://localhost:8000/admin/
- Postgres — localhost:5432 (user/pass from `.env`)
- Redis — localhost:6379

### Seed the three owners (Phase 1)

```bash
# As pending invites (you copy the setup link from the console output):
docker compose exec api python manage.py seed_owners

# Or active immediately with a shared dev password (local only):
docker compose exec api python manage.py seed_owners \
    --activate-with-password Versuitality@2026
```

The owner accounts are:

- Sirish Kumar Golem — `sirish@versuitality.com`
- Tripti Kumari Golem — `tripti@versuitality.com`
- Rahul Vankamamidi — `rahul@versuitality.com`

All seeded as `admin` role.

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

Currently shipping: **Phase 2** (CRM + measurement form).

## Phase 1 — what's live

- **Custom user model** (`accounts.User`) keyed by email, with role enum
  (`admin` / `staff` / `master` / `qa` / `accountant`).
- **JWT auth** via `djangorestframework-simplejwt` with refresh-token
  rotation + blacklist on logout.
- **Endpoints**: `POST /api/auth/login/`, `POST /api/auth/logout/`,
  `POST /api/auth/refresh/`, `GET /api/auth/me/`,
  `POST /api/auth/setup-password/`, `GET /api/auth/invite/<token>/`,
  full CRUD on `/api/users/` (admin-only) plus
  `POST /api/users/<id>/reissue_invite/`.
- **Admin-invite flow**: admin creates a user → one-time `InviteToken`
  is issued → invitee opens `/setup-password?token=…`, sets a password,
  account activates and they're logged straight in. Email delivery is
  stubbed until Phase 6.
- **Audit log** (`accounts.AuditLog`) capturing logins, login failures,
  invitations, role changes, activation/deactivation, password sets.
- **Frontend** — Zustand auth store with localStorage persistence, fetch
  client with single-flight refresh interceptor, role-aware sidebar +
  topbar shell, glassmorphic dashboard with role-personalised next-steps,
  admin Team & Roles page (search, role change, activate/deactivate,
  re-issue invite, copy setup link).

## Phase 2 — what's live

- **CRM** (`crm.Client`) — UUID PK, auto-assigned `VS-CL-XXXXXX` client ID,
  unique mobile (normalised), preferences as JSON arrays, address, age
  group, photo URL, internal notes, audited `created_by`.
- **Measurements** (`measurements.MeasurementSet`) — direct digital twin of
  the paper form (10 upper points, 8 lower points, suit lapel/button/vent,
  half-inch precision), garment-types selection, fabric details,
  customisation notes, **cloth image upload** to local media in dev, fully
  versioned by visit timestamp.
- **Endpoints**: `/api/clients/` CRUD, `/api/clients/search/?q=` (name,
  mobile last-4, client ID, email), `/api/clients/by_mobile/` for
  returning-client detection, `/api/clients/<id>/measurements/export/`
  (Excel via openpyxl, gold-headered workbook), `/api/measurements/` CRUD
  with multipart support for cloth images.
- **Frontend** — `/clients` list (search, stat tiles, glassmorphic cards),
  multi-step `/clients/new` intake (Contact → Preferences → Measurements
  → Review) with **returning-client detection while typing**,
  `/clients/[id]` profile (Overview / Measurements / Orders / Notes tabs)
  with Excel export, `/clients/[id]/measurements/new` for repeat visits.
- **Live silhouette reference** — focusing a measurement field highlights
  the corresponding hotspot on a stylised front-view SVG so staff never
  guess which body point each field maps to.
- **Global search** — topbar input becomes a real fuzzy search with debounce,
  keyboard nav (↑/↓/Enter/Esc), and ⌘/Ctrl-K shortcut. Searches name,
  mobile, last-4 digits, and client ID.

