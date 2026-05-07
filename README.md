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

Currently shipping: **Phase 4** (Real-time order board via Django Channels).

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

## Phase 3 — what's live

- **`orders.Order`** — UUID PK, atomic `VS-YYYYMMDD-XXXX` order ID via a
  per-day `OrderDailyCounter` table, FK to client + (optional)
  measurement set, `order_type` (full / alteration), trial/delivery
  dates, subtotal/advance/balance, internal notes.
- **`OrderLineItem`** — garment type, fabric description, quantity,
  unit price, customisation notes, position. Line totals + auto-roll-up
  to subtotal.
- **`OrderStatusEvent`** — append-only timeline; every transition logs
  actor, role, reason, timestamp.
- **State machine** with role-aware transitions
  (`apps.orders.transitions`). Master drives production, QA owns the
  pass/fail step, Staff handles intake + delivery, Admin can force-set.
  `qc_rejected` requires a reason.
- **Endpoints**: `/api/orders/` CRUD with filtering (`?status=…&client=…&q=…&from=…&to=…`),
  `POST /api/orders/<id>/transition/` with target + optional reason,
  `GET /api/orders/<id>/pdf/` (ReportLab),
  `GET /api/orders/stats/` (KPIs + per-status counts),
  `GET /api/orders/transitions_map/`.
- **Premium PDF receipt** — gold/navy brand chrome, status banner, client
  + meta block, line-items table with totals, full measurement grid,
  status timeline. Generated via ReportLab on the fly.
- **Frontend** — `/orders` list with KPIs, status filter chips, kanban
  view when "All" is selected, search; `/orders/new` 4-step flow
  (Client → Garments → Measurements + schedule → Review) with line-item
  editor and live subtotal; `/orders/[id]` detail with status timeline,
  next-status quick actions (reason modal for QC rejection), PDF
  download button. Client profile Orders tab now lists real orders;
  dashboard tiles show live counts (active, last-7-days, pending QC,
  delivered today).

## Phase 4 — what's live

- **Django Channels** wired into the existing ASGI app via daphne. New
  `apps.realtime` module owns the WebSocket layer.
- **JWT-authenticated WebSocket** — clients connect to
  `ws://api/ws/orders/?token=<access>`; a `JWTAuthMiddleware` resolves
  the active user via SimpleJWT's `AccessToken`. Anonymous sockets are
  closed with code 4401.
- **Redis channel layer** — `channels_redis` runs over the same Redis
  instance from Phase 0's compose file.
- **`OrderBoardConsumer`** subscribes every authenticated client to the
  `orders.board` group. On `connect` it sends a `hello` payload with the
  user's role and server time so the client can sanity-check.
- **Broadcaster** — `apps.realtime.broadcaster` exposes
  `order_created`, `order_status_changed`, and `order_updated`. The
  order viewset and the transition pipeline call these after every
  successful mutation. Failures fall back to a logged warning so the
  HTTP request still succeeds if Redis hiccups.
- **Frontend** — singleton `OrderBoardSocket` with exponential-backoff
  reconnect (cap 15 s) that automatically re-auths whenever the Zustand
  auth store rotates the access token. `useOrderBoardSocket` hook for
  components, plus `useOrderBoardStatus` for the new live indicator pill
  in the topbar (Live · Connecting · Reconnecting · Offline).
- **Live `/orders` board** — incoming events update the cards in place,
  pulse a gold ring on the affected card for ~2s, and fire a glassy
  toast (`VS-… → Stitching in progress`) in the bottom-right. The KPI
  tiles and per-status filter counts recompute client-side from the
  same data so the page never shows a stale snapshot.
- **Live dashboard** — admin/staff/master/qa tiles refetch the order
  stats whenever an event arrives, keeping "Active in production",
  "Pending QC" and "Delivered today" accurate without a refresh.

