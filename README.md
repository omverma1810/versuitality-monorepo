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

Currently shipping: **Phase 8** (Admin analytics).

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

## Phase 5 — what's live

- New `apps.qa` Django app with a single source-of-truth checklist
  (`apps/qa/checklist.py`) covering stitching, finishing, measurement
  match, buttons & buttonholes, lining, pressing, and fabric integrity.
- **`QcInspection`** model — multiple inspections per order (rework
  loops are first-class), JSON checklist payload, inspector, overall
  comment, timestamp.
- **Endpoints**: `GET /api/qa/checklist/` (definition for the UI),
  `GET /api/qa/queue/` (orders currently `ready_for_qc`),
  `GET /api/qa/inspections/?order=<id>` (history),
  `POST /api/qa/inspections/submit/` (records the inspection and drives
  the order through the state machine — pass → `ready_for_delivery`,
  fail → `qc_rejected` with the reason summarising failed items).
- Submission validates that **every checklist item is answered**, that
  the outcome matches the responses (no passes with failed items), and
  that fail outcomes carry context — a comment or per-item notes — so
  the master knows what to rework.
- **Frontend** — `/qa` queue page (live: refetches when order events
  fire) and `/qa/[orderId]` inspection form with per-item Pass/Fail
  buttons, contextual note fields, an overall comment, prior-inspection
  history, confirmation modal, and dual-action buttons (Pass → ready
  for delivery, Reject → start rework). Order detail surfaces the QC
  inspection history (latest highlighted, failed items expanded with
  per-item notes) and gives QA/admin a "Start QC inspection" CTA when
  the order is in the queue.

## Phase 6 — what's live

- New `apps.notifications` Django app with a clean **provider abstraction**
  (`apps/notifications/providers/base.py`). Two real providers
  (`SendGridEmailProvider`, `TwilioWhatsAppProvider`) plus
  `ConsoleEmailProvider` / `ConsoleWhatsAppProvider` as the no-creds
  fallback.
- **Env-driven router** (`get_email_provider`, `get_whatsapp_provider`):
  if `SENDGRID_API_KEY` is present → SendGrid takes over; if all three
  Twilio variables are set (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_WHATSAPP_FROM`) → Twilio takes over. Otherwise the console
  providers log the rendered message and stamp the Notification row as
  `sent` via `console:*`. Drop creds into `.env` to flip live — no
  code changes.
- **Premium-voice templates** (`apps/notifications/templates.py`) per
  status transition (order received, requirements noted, cutting,
  stitching, ready-for-trial, alterations underway, ready-for-delivery,
  delivered/thank-you). Internal-only statuses (`ready_for_qc`,
  `qc_rejected`) intentionally suppress client dispatch. Templates use a
  `_SafeMap` so missing context keys never crash the pipeline.
- **`Notification` model** records every dispatch attempt with channel,
  recipient, template key, rendered subject/body, status (pending /
  sent / failed / skipped), provider, provider message id, error, and
  metadata. Indexed by `(order, -created_at)` for the per-order log.
- **Hooks**: `apps.orders.views.create()` fires `notify_order_created`
  after the WS broadcast. `apps.orders.transitions.transition_order()`
  fires `notify_order_status_changed`. Both calls are wrapped in
  try/except — messaging is a best-effort overlay on the durable HTTP
  API, so a provider hiccup never breaks an order update.
- **Endpoints**: `GET /api/notifications/?order=<id>` (filterable also
  by `channel` + `status`).
- **Frontend** — order detail (`/orders/[id]`) gains a Notifications
  panel below the timeline showing each dispatch with its channel icon
  (Mail / MessageCircle), status pill (Sent / Failed / Pending), provider
  badge ("Console (dev)" when running on the fallback), recipient, and
  timestamp. Click any row to expand the rendered subject + body and
  the provider message id / error. Refetches automatically after each
  status transition so the just-fired email and WhatsApp messages
  appear immediately.

## Phase 7 — what's live

- New `apps.inventory` Django app: `Fabric` (auto `VS-FB-XXXXX` codes,
  supplier, color, pattern, fabric_type, quantity in metres,
  `low_stock_threshold`, cost & price per metre, image url, soft delete
  via `is_active`) and `FabricUsage` — a **signed-delta ledger** so the
  running sum equals the cached `quantity_meters`. Movements happen
  through `apps.inventory.services.adjust_stock`, which holds a
  `select_for_update` row-lock to prevent concurrent order creations
  from racing on the same bolt.
- `OrderLineItem` gained `fabric` (FK) + `meters_used`. When a line
  carries both, order creation deducts stock + writes a `FabricUsage`
  ledger entry inside the same atomic transaction. Insufficient stock
  rolls the entire order back with a clean error.
- New `apps.appointments` Django app: `Appointment` model with snapshot
  contact fields (so prospects without CRM records work too), kind
  (Measurement / Trial / Consultation / Delivery / Other), status,
  `notify_via` preference, `reminder_sent_at` timestamp, scheduled
  duration, and notes. Indexed on `(scheduled_at)` and
  `(status, scheduled_at)` for fast queue lookups.
- Appointment endpoints: full CRUD on `/api/appointments/`,
  `GET /api/appointments/today/` for the dashboard widget,
  `POST /api/appointments/<id>/transition/` (complete / cancel / no-show
  with optional timestamped note appending).
- Two new notification templates — `appointment_scheduled` (fires on
  create) and `appointment_reminder` (fires from the cron). The
  reminder pipeline is implemented as
  `apps.appointments.services.send_due_reminders` and a
  `python manage.py send_appointment_reminders --lead 120` management
  command — idempotent, marks `reminder_sent_at` so re-runs don't double
  fire. Hook to cron when SendGrid + Twilio creds land.
- Inventory endpoints: full CRUD on `/api/fabrics/`,
  `POST /<id>/adjust/` (signed delta + kind + note), `GET /<id>/usage/`,
  `GET /api/fabrics/low_stock/`, plus a read-only `/api/fabric-usage/`
  for cross-fabric audits.
- **Frontend**:
  - `/inventory` list — KPIs (active fabrics, total stock, stock value,
    low-stock count), search, low-stock filter chip, glass cards that
    glow red at the border when below threshold.
  - `/inventory/[id]` — header KVs, **inline stock-movement form** with
    Stock-In / Stock-Out buttons + kind picker + note, full ledger view
    with green/red rows showing every prior movement and order
    cross-link.
  - `/inventory/new` — three-section form (identity, stock & pricing,
    notes & image) with chip-style pattern picker.
  - `/appointments` — date-grouped list with status pills, quick
    Complete/Cancel buttons, filter chips (Upcoming / Today / All /
    Completed / Cancelled).
  - `/appointments/new` — pick an existing client via `ClientPicker` or
    enter prospect details; pick kind, time, duration, reminder
    preference; saves and routes back to the list.
  - **Order new flow** gains a fabric picker + metres input on every
    line — disabled until a fabric is selected, deducts on save.
  - **Dashboard** gets two new widgets when relevant: today's
    appointments (top 5, with kind + time + mobile) and low-stock alerts
    (top 5, with current quantity + threshold). Both auto-hide when
    empty.
  - Sidebar Inventory + Appointments entries are now always live.

## Phase 8 — what's live

- New `apps.analytics` Django app with a single composer
  (`apps.analytics.services.build_summary`) that fans out into
  status distribution, month-on-month KPIs, headline counters,
  garment mix, top-clients leaderboard, daily revenue trend (zero-
  filled), stage funnel (avg days each order spends in each status,
  derived from `OrderStatusEvent`), and QC rejection rate.
- **Endpoints** — `GET /api/analytics/summary/?from=&to=` (admin /
  accountant only), and `GET /api/analytics/orders.xlsx/?from=&to=`
  for a date-range Excel of every order in the window with totals,
  client info, and status timeline metadata.
- **`/admin/analytics`** page — gated to admin + accountant. Date-range
  picker (defaults to month-to-date), four KPI tiles with month-on-
  month deltas (orders + revenue) and live counters, full-width
  revenue trend Sparkline with peak-day callout, **donut chart** of
  status distribution, **garment-mix horizontal bars**, **stage-funnel
  bars** showing average days per status, semicircular **QC gauge**
  (green ≤ 5%, gold ≤ 15%, red beyond), and a **top-clients**
  leaderboard with deep-links into each profile.
- All charts are pure SVG / CSS — no chart library — so they share the
  brand palette and respect the gold + navy tokens.
- Page subscribes to the WebSocket order stream and refetches the
  summary (debounced 600 ms) so analytics stay live without polling.
- Dashboard next-steps for admin / accountant updated to reflect the
  shipped surface.


