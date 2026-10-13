# Versuitality — project context

> Hand-off document. Read this first when picking the project up on a new machine or in a new Claude Code
> session. It contains **no secrets** (passwords and keys live in Google Secret Manager, GitHub variables and
> your password manager). Keep it current: update the "State" and "Next" sections when you finish work.
>
> Last updated: 2026-10-13 · `master` @ the commit that added this file.

---

## 1. What this is

**Versuitality Operations** — an internal operations platform for a bespoke men's tailoring atelier
(brand colours gold `#CBA624`, navy `#261F53`; order IDs `VS-YYYYMMDD-XXXX`, client IDs `VS-CL-XXXXXX`).
It runs the shop from the client walking in, through measurements, production, quality check and
delivery, to finance.

Five roles: **admin** (owners), **staff** (front desk), **master** (master tailor), **qa** (quality control),
**accountant**.

Monorepo (pnpm workspace):

```
apps/api        Django 5.2 + DRF + Channels (daphne), PostgreSQL        -> Google Cloud Run
apps/web        Next.js 15 (App Router) + React 19 + Tailwind + Zustand -> Vercel
packages/ui     shared UI primitives            packages/types  shared TS types + labels
deploy/gcp      Cloud Shell scripts (deploy, WIF setup, image pruning)
docs/user-manual  the client-facing manual (generator + manifest; PDF/videos are generated)
.github         workflows: ci.yml (CI + CD), codeql.yml;  dependabot.yml
OPERATIONS.md   runbook (single-VM docker-compose + section 11/12 for the managed stack)
```

## 2. Production topology (all live)

| Piece | Where | Notes |
| --- | --- | --- |
| API | Google Cloud Run, project `versuitality` (number `275158399951`), region `asia-south1`, service `versuitality-api` | one instance (`min=max=1`), in-memory Channels layer, 1 GiB, port 8080 |
| Database | Supabase Postgres, project ref `qfglbgivvlmiubnxsnbm` | Django connects as owner `postgres`; RLS is ON for every table and `anon`/`authenticated` are revoked (Data API locked) |
| Web | Vercel project `versuitality-monorepo-web` (Git integration, auto-deploys on push to `master`) | `NEXT_PUBLIC_API_BASE_URL` is a **Vercel project env var**, baked at build time |
| Secrets | Secret Manager: `versuitality-django-secret`, `versuitality-db-password`, `versuitality-seed-owner-password` | never in git |
| Images | Artifact Registry repo `versuitality` (CI) + legacy `cloud-run-source-deploy` | **only the newest 3 images/revisions are kept** |
| Seed job | Cloud Run Job `versuitality-api-seed` runs `seed_owners` | creates the 3 owner logins |

API URL forms (equivalent): `https://versuitality-api-275158399951.asia-south1.run.app` and the hashed
`…-ytdlcvffca-el.a.run.app`. The API must allow the web origin(s) via `DJANGO_CORS_ORIGINS`,
`DJANGO_CSRF_TRUSTED_ORIGINS`, `WEB_BASE_URL` (see section 8, "Operations").

## 3. Architecture notes that matter

- **RBAC is enforced server-side** by `RoleMatrixPermission` (`apps/accounts/permissions.py`): each viewset
  declares `read_roles`, `write_roles`, `action_roles`; admin/superuser always pass. The UI hides things too,
  but the API is the real gate (tested over ~30 endpoints × 5 roles).
- **Order state machine** — `apps/orders/models.py` (`ALLOWED_TRANSITIONS`) + `apps/orders/transitions.py`
  (`TRANSITION_ROLES`, `can_transition`, `transition_order`):
  `order_received → requirements_noted → cutting_started → stitching_in_progress → ready_for_trial →
  (alteration_in_progress) → ready_for_qc → ready_for_delivery → delivered`, with `qc_rejected` looping back to the
  master. Who moves what: staff/master note requirements; master does all production; **QA** passes/rejects;
  **staff** deliver; admin can force any status. `cancelled` is a separate, final state (see below).
- **`next_statuses` is role-filtered server-side** so the UI only shows buttons the role may use.
- **Edit/cancel** (`apps/orders/services.py`): `PATCH /api/orders/{id}/` (dates, advance, notes, measurement set;
  garments/order type only before cutting; delivered orders accept only advance/notes; advance ≤ total),
  `POST /api/orders/{id}/cancel/` (reason required; optional fabric return; final; excluded from active counts and
  analytics). Status can never be changed via PATCH. Everything is audited (`AuditLog`).
- **Returning-customer recognition** (`apps/crm/profile.py`, `by_mobile`, `/clients/{id}/profile/`): mobiles are
  normalised to `+<cc><number>` (`apps/crm/utils.py`, default country 91). `by_mobile` matches the primary or
  alternate number and returns the client + latest measurement set + recent orders (for "Repeat order").
  Web: `ClientPicker` detects a full phone number, `ReturningClientCard`, order wizard auto-links the newest
  measurements, intake blocks duplicates, `?mobile=` / `?next=order` carry through, measurement form pre-fills from
  the last visit (`returnTo` is same-site only).
- **Real time**: Channels WebSocket `/ws/orders/` (JWT in query string, `OriginValidator`); events
  `order_created / order_status_changed / order_updated`.
- **Security hardening**: `enable_rls` management command runs on every deploy (entrypoint); WhiteNoise for static;
  non-root container; production refuses to start with the dev secret key; secure cookies when not DEBUG.
- **Uploads** (cloth photos) are stored on the container disk → **lost on redeploy** (needs object storage).
- **Notifications** use a provider abstraction; without SendGrid/Twilio keys they go to the **console provider**
  (logged, shown in the order's Notifications panel as "CONSOLE (DEV)").

## 4. Web app map (`apps/web/src`)

`app/(auth)/login`, `setup-password` · `app/(app)/dashboard, clients (list/new/[id]/measurements/new), orders
(list/new/[id]/[id]/edit), qa (queue/[orderId]), appointments (list/new), inventory (list/new/[id]),
admin/users, admin/analytics, admin/audit` · `components/shell` (sidebar, topbar, nav-config with per-role links)
· `lib/*.ts` API clients · `store/*` Zustand (auth, toasts, navigation).
Gotchas: `useSearchParams` needs Suspense in static pages (root layout wraps `NavigationFeedback`); typed routes are
on (`as never` casts are used for dynamic hrefs); `/api` rewrite loops on trailing slashes so the browser calls the
API origin directly; Google Fonts are blocked in the dev sandbox (see section 6).

## 5. Quality gates & CI/CD

`.github/workflows/ci.yml` (every PR and push to `master`):
API (ruff, bandit, pip-audit, pytest incl. migration-drift + WebSocket tests, Postgres service) · Web (lint,
typecheck, `pnpm audit --prod`, build) · **E2E** (Playwright against a real API + Postgres + built web) ·
Security (gitleaks, hadolint, Trivy config/secret scan) · Image (build the prod image, **boot it**, Trivy scan) ·
**Deploy** (master only, after all of the above): build → Trivy → push to Artifact Registry → deploy a
**no-traffic** Cloud Run revision → smoke-test `/api/health/` + `/api/readiness/` → shift traffic → roll back on
failure → `deploy/gcp/prune-images.sh` (keep newest 3 images + revisions). Auth to Google is keyless (Workload
Identity Federation, only `omverma1810/versuitality-monorepo` @ `master`). The deploy job needs the repo
variables `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` (set; produced by
`deploy/gcp/setup-github-deploy.sh`). Third-party security actions are pinned by SHA; Dependabot is weekly.
`codeql.yml` runs weekly + on PRs. The web app is deployed by Vercel's own Git integration, separately.

Test suites: **backend** `apps/api/tests` (152 tests: RBAC matrix, orders, modules, platform/WS) and **Playwright**
`apps/web/e2e` (51 specs: auth/role nav, intake, order lifecycle, QA reject, admin/API gates, per-role page smoke,
edit/cancel, returning customer).

## 6. Run it locally

Prereqs: Node 22 + pnpm 9, Python 3.12, PostgreSQL 16 (or Docker).

```bash
pnpm install
# API (apps/api)
python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
export DJANGO_DEBUG=1 DJANGO_SECRET_KEY=local-dev-key-change-me-0123456789abcdef \
       POSTGRES_HOST=localhost POSTGRES_DB=versuitality POSTGRES_USER=postgres POSTGRES_PASSWORD=... \
       DJANGO_CORS_ORIGINS=http://localhost:3000
python manage.py migrate && python manage.py seed_demo          # needs an active admin: seed_owners first
daphne -p 8000 versuitality.asgi:application
# Web (apps/web)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

Or `docker compose up --build` (see `docker-compose.yml`, `OPERATIONS.md`).

**Tests**
```bash
(cd apps/api && pytest -q && ruff check . && bandit -r apps versuitality -ll -q -x tests)
# E2E: seed one user per role, start api+web, then
(cd apps/api && E2E_PASSWORD=... python manage.py shell < ../web/e2e/seed_e2e.py)
(cd apps/web && E2E_PASSWORD=... pnpm exec playwright install chromium && pnpm e2e)
```
Env vars for E2E: `E2E_PASSWORD` (required), optional `E2E_BASE_URL`, `E2E_API_URL`, `PW_CHROMIUM_PATH`.

**Claude/cloud-sandbox quirks** (only if you work in the managed sandbox): no egress to GCP/Supabase/Google Fonts;
a throwaway Postgres is run from `pgserver` and must be (re)started as a non-root user after a reset; local `next
build` needs `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<mock file>`; avoid `pkill -f`/`pgrep -f` with patterns that appear in
your own command line (it kills the shell) — use pid files.

## 7. User manual & recorded walkthrough

`docs/user-manual/` holds the generator, manifest and README. `apps/web/e2e-manual/` (parts A–F) drives a real
browser through every role against a **local** stack seeded with fictional data (`@atelier.demo`), recording
captions + cursor video and screenshots. `docs/user-manual/build.sh` produces the branded A4 PDF
(currently 42 pages, 75 figures). Generated artefacts (PDF, images, videos, zip) are gitignored — regenerate with
the steps in `docs/user-manual/README.md` and update the manual whenever the UI changes.

## 8. Operations cheat-sheet

```bash
# Allow the web origin(s) to call the API (CORS / CSRF / links) — safe to re-run
O="https://versuitality-monorepo-web.vercel.app,https://versuitality-monorepo-web-om-vermas-projects.vercel.app,https://versuitality-monorepo-web-git-master-om-vermas-projects.vercel.app"
gcloud run services update versuitality-api --region asia-south1 \
  --update-env-vars "^|^DJANGO_CORS_ORIGINS=$O|DJANGO_CSRF_TRUSTED_ORIGINS=$O|WEB_BASE_URL=https://versuitality-monorepo-web.vercel.app"

# First-time / full manual deploy from Cloud Shell (prompts for secrets; stores them in Secret Manager)
bash deploy/gcp/deploy-api.sh
# One-time GitHub→GCP trust + Artifact Registry cleanup policy (already done)
bash deploy/gcp/setup-github-deploy.sh
# Preview / run the image + revision pruning (keeps newest 3)
DRY_RUN=1 bash deploy/gcp/prune-images.sh
```
Supabase notes: if the direct host (`db.<ref>.supabase.co`) is IPv6-only and Cloud Run can't reach it, use the
Session pooler host/user (`DB_HOST`, `DB_USER`). Rotating the DB password = change it in Supabase, then
`gcloud secrets versions add versuitality-db-password --data-file=-` and redeploy (push to `master`).
Pushing to `master` deploys both API (GitHub Actions) and web (Vercel).

## 9. State at the time of writing

Done and live: auth/invites/RBAC · CRM + digital measurement sheet · orders (wizard, PDF receipt, state machine,
edit, cancel, repeat order) · QA checklist with reject/rework loop · real-time board · fabric inventory with
auto-deduct + ledger · appointments · analytics + Excel export · audit log reader · returning-customer recognition ·
Supabase RLS lock-down · full CI/CD with image pruning · user manual (PDF) + videos · 152 backend / 51 browser tests.

Not verified against the live URLs from the sandbox (egress blocked) — always sanity-check a deploy by signing in on
the live site and creating an order.

## 10. Known limits / backlog (suggested order)

1. **SendGrid + Twilio keys** → real customer email/WhatsApp (add as Cloud Run secrets `SENDGRID_API_KEY`,
   `TWILIO_*`; see `OPERATIONS.md` §4). Until then messages are only logged.
2. **Appointment reminders need a scheduler on Cloud Run**: `python manage.py send_appointment_reminders --lead 120`
   is idempotent but nothing calls it in the managed setup (Cloud Scheduler → Cloud Run Job).
3. **Cloth photo storage** (GCS bucket via `django-storages`) — images are lost on redeploy today.
4. **Forgot-password flow** (today an admin re-issues a setup link from Team & roles).
5. Payments beyond the advance (balance collection, invoice/GST receipt).
6. Scale-out: Redis (`REDIS_URL`) for the Channels layer before raising `--max-instances`.
7. Production hygiene: error monitoring/uptime alerts, confirmed Supabase backups/PITR, custom domain, branch
   protection requiring CI on `master`, import tool for an existing client list.
8. Housekeeping: 2 dev-tool-only `pnpm audit` advisories (no fix upstream), Node 20 deprecation warnings in a few
   actions, Vercel SSO protection on `*.vercel.app` previews.

## 11. Conventions

- Work on `master`; CI must be green before relying on a deploy. Commit messages: what + why; no secrets ever
  (gitleaks runs in CI; test/e2e passwords are throwaway and allow-listed by path).
- Never write the DB password or any real credential to the repo, docs or chat; rotate if it leaks.
- Any new endpoint: add it to the role matrix tests in `apps/api/tests/test_rbac.py`; any new screen: add it to
  `apps/web/e2e/smoke.spec.ts` (it asserts no failing API calls per role).
- UI copy is client-facing: no internal phase/dev wording.
- After a UI change, re-run the walkthrough parts you touched and rebuild the manual.

## 12. Resuming with Claude Code

1. `git clone https://github.com/omverma1810/versuitality-monorepo && cd versuitality-monorepo && git pull`
2. Open Claude Code in the repo and say: *"Read context.md, OPERATIONS.md and the last 15 commits, then continue
   with <task from section 10>."*
3. For anything touching production, have it run the full suites first (section 6) and confirm CI is green after the
   push (`gh api repos/omverma1810/versuitality-monorepo/actions/runs`).
