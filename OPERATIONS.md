# Versuitality — Operations Runbook

Day-to-day operational reference for deploying, running, and maintaining the
Versuitality stack. The README covers product / phase scope; this file is for
the people keeping the system alive in production.

---

## 1. Stack at a glance

| Layer    | Tech                                                             |
| -------- | ---------------------------------------------------------------- |
| Web      | Next.js 14 (App Router), React 18, TS, Tailwind, Zustand, FM     |
| API      | Django 5 + DRF + Channels (daphne ASGI), JWT auth                |
| DB       | PostgreSQL 16                                                    |
| Cache/MQ | Redis 7 (Channels broker + ad-hoc cache)                         |
| Email    | SendGrid (or any swap-in provider — abstraction in `apps.notifications.providers`) |
| WhatsApp | Twilio                                                           |
| Storage  | Local media in dev; S3 / Cloudflare R2 wired-but-unset for prod  |
| Exports  | ReportLab (PDF), openpyxl (Excel)                                |

Nothing here imposes Kubernetes — a single VM with `docker compose` is enough
for one shop. Scale-out plans below.

---

## 2. First-time deployment (single VM)

### 2.1 Prerequisites

- Ubuntu 22.04+ / Debian 12+ host with Docker and `docker compose v2`
- Public hostname with DNS pointed at the VM (e.g. `versuitality.example.com`)
- 80/443 reachable for the Caddy / Nginx reverse proxy
- 2 vCPU / 4 GB RAM is comfortable for one store; bump for ≥10 staff

### 2.2 Bring up the stack

```bash
git clone git@github.com:omverma1810/versuitality-monorepo.git /opt/versuitality
cd /opt/versuitality
cp .env.example .env

# Edit .env — set DJANGO_SECRET_KEY to a random 64-char string.
# Other prod settings:
#   DJANGO_DEBUG=0
#   DJANGO_ALLOWED_HOSTS=versuitality.example.com,api
#   DJANGO_CORS_ORIGINS=https://versuitality.example.com
#   WEB_BASE_URL=https://versuitality.example.com

docker compose up --build -d
docker compose exec api python manage.py migrate --noinput
docker compose exec api python manage.py collectstatic --noinput

# Seed the three owners (pending invites — they pick passwords from the link)
docker compose exec api python manage.py seed_owners

# Or for a quick dev-style bootstrap:
docker compose exec api python manage.py seed_owners \
    --activate-with-password 'Versuitality@2026'

# Optional — load realistic demo data:
docker compose exec api python manage.py seed_demo
```

### 2.3 Reverse proxy (Caddy — recommended)

Caddy handles HTTPS, HTTP/2, and WebSockets in two lines:

```caddy
versuitality.example.com {
    reverse_proxy /api/* api:8000
    reverse_proxy /admin/* api:8000
    reverse_proxy /ws/* api:8000
    reverse_proxy /media/* api:8000
    reverse_proxy * web:3000
}
```

Drop `Caddyfile` next to `docker-compose.yml` and add a `caddy` service that
mounts it. Hot-reload TLS, no manual cert renewals.

### 2.4 First login

1. Open `https://versuitality.example.com/login`
2. Sign in as one of the owners (Sirish / Tripti / Rahul) using the password
   you supplied (or follow the invite link printed by `seed_owners`)
3. Sidebar → **Team & roles** → invite each staff member with the right role
4. They receive a one-time setup link; password is set in-app

---

## 3. Environment reference

`/.env` holds every runtime knob. Categories:

### 3.1 Required (every environment)

| Var                    | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `DJANGO_SECRET_KEY`    | Django crypto root. **Rotate on suspected leak.**    |
| `DJANGO_DEBUG`         | `0` in prod, `1` in dev only                         |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated, includes the public hostname        |
| `DJANGO_CORS_ORIGINS`  | Comma-separated, includes the web origin             |
| `POSTGRES_*`           | DB credentials                                       |
| `REDIS_HOST`/`PORT`    | Channels + readiness                                 |
| `WEB_BASE_URL`         | Used to build links inside server-generated emails   |
| `NEXT_PUBLIC_API_BASE_URL` | Web → API base URL                                |

### 3.2 Notifications (optional — see §4 for handover)

| Var                            | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `SENDGRID_API_KEY`             | Email provider key                            |
| `NOTIFICATION_EMAIL_FROM`      | From-address for client emails                |
| `NOTIFICATION_EMAIL_FROM_NAME` | Display name on emails                        |
| `TWILIO_ACCOUNT_SID`           | Twilio account                                |
| `TWILIO_AUTH_TOKEN`            | Twilio token                                  |
| `TWILIO_WHATSAPP_FROM`         | `whatsapp:+E164` sender — e.g. sandbox or BSP |

### 3.3 Storage (when going live with S3 / R2)

| Var          | Purpose                          |
| ------------ | -------------------------------- |
| `S3_BUCKET`  | Bucket name                      |
| `S3_REGION`  | AWS region                       |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credentials |

> Today the API uses Django's local `MediaFileSystemStorage` for cloth images
> and any other uploads. Wire `django-storages[boto3]` + the env vars above
> when moving to object storage.

---

## 4. Notification creds handover

The pipeline is provider-abstracted so flipping live is a config change.

**Day 0 (current state):** `SENDGRID_API_KEY` and Twilio vars are blank. The
console providers log every rendered message and stamp the `Notification` row
as `sent` via `console:*`. The UI badges these rows "Console (dev)" so it's
visually obvious you're not in live delivery.

**Day N (creds arrive):**

```bash
# Edit .env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
NOTIFICATION_EMAIL_FROM=orders@versuitality.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

docker compose restart api
```

That's it. The next status transition or order creation goes out via
SendGrid + Twilio. No code change, no migration. Validate by:

1. Creating a test order with your own email + mobile
2. Watch the order detail Notifications panel switch from "Console (dev)" to
   "sendgrid" / "twilio:whatsapp"
3. Confirm receipt on the live channels

If a provider misbehaves, it logs at `WARNING` and the row goes to `failed` —
you can re-trigger from the Django admin or via a new transition. The HTTP
request that triggered it never fails because of provider errors.

---

## 5. Cron — appointment reminders

Reminders fire from `python manage.py send_appointment_reminders --lead 120`,
which is **idempotent** (marks `reminder_sent_at` so re-runs never double-fire).

Add to crontab on the host:

```cron
*/5 * * * * docker compose -f /opt/versuitality/docker-compose.yml \
  exec -T api python manage.py send_appointment_reminders --lead 120 \
  >> /var/log/versuitality/reminders.log 2>&1
```

When you outgrow cron, swap to a Celery beat task — the `services.send_due_reminders`
function is the entry point either way.

---

## 6. Backups

### 6.1 Postgres (logical dump)

```bash
# Daily dump, keep 14 days
0 2 * * * docker compose -f /opt/versuitality/docker-compose.yml \
  exec -T postgres pg_dump -U versuitality versuitality | \
  gzip > /var/backups/versuitality/db-$(date +\%F).sql.gz

# Optional offsite copy
0 3 * * * aws s3 sync /var/backups/versuitality \
  s3://versuitality-backups/db/ --delete
```

Restore drill (run quarterly):

```bash
gunzip -c db-2026-05-07.sql.gz | \
  docker compose exec -T postgres psql -U versuitality versuitality
```

### 6.2 Media

Cloth images are written to the API container's `/app/media`. Mount that to a
host volume (the dev compose already does — `./apps/api/media`) and back it up
nightly the same way as the DB.

When you migrate to S3, point storage there and remove the host backup step;
S3 has its own lifecycle rules.

---

## 7. Health & monitoring

| Endpoint            | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `/api/health/`      | Liveness — does the process answer?                       |
| `/api/readiness/`   | Readiness — pings Postgres + Redis. Returns 503 on fail.  |

Hook either to your uptime watcher (UptimeRobot / Better Uptime / etc.).
For Kubernetes-style probes:

```yaml
livenessProbe:
  httpGet: { path: /api/health/, port: 8000 }
  periodSeconds: 30

readinessProbe:
  httpGet: { path: /api/readiness/, port: 8000 }
  periodSeconds: 10
  failureThreshold: 3
```

Logs land in `docker compose logs api` and `docker compose logs web`. Pipe
into your aggregator of choice (Loki, CloudWatch, Datadog, …).

---

## 8. Common operations

### 8.1 Add or revoke a teammate

UI: `/admin/users` → Invite teammate / change role / deactivate. The audit
log captures every change — see Django admin > Audit logs.

### 8.2 Reset a forgotten password

Admin opens `/admin/users` → finds the user → clicks **Resend** to issue a
fresh single-use setup link → shares it with the teammate.

### 8.3 Walk an order through manually (recovery)

Open `/orders/<id>` as Admin. The status update panel shows every legal
forward transition; Admin can also force any status from Django admin.

### 8.4 Re-issue a PDF

PDFs are generated on demand from `/api/orders/<id>/pdf/`. Re-downloading
always reflects the current state of the order — no caching.

### 8.5 Refresh demo data

```bash
docker compose exec api python manage.py seed_demo --fresh
```

`--fresh` deletes the seeded clients (and cascades through their measurements,
orders, etc.) and the seeded fabrics + appointments before re-seeding.

---

## 9. Scaling notes (when one VM stops being enough)

1. **Promote Postgres to managed** (RDS / Cloud SQL). Cheapest move; the app
   needs no code changes.
2. **Run two API replicas** behind the reverse proxy. Channels uses Redis as
   the transport, so WS connections fan out automatically across replicas.
3. **Promote Redis to managed**. Use Elasticache / Memorystore.
4. **Front the web with a CDN** (Vercel / CloudFront). Static + ISR is a
   good fit for the Next.js app.
5. **Switch sync notifications → Celery**. The `notify_*` functions are thin
   wrappers; replace each with `<task>.delay(...)`. Add a Celery worker
   container, broker stays Redis.
6. **Move uploads → S3** with `django-storages` (env vars in §3.3).

---

## 10. Security checklist before going live

- [ ] `DJANGO_SECRET_KEY` rotated to a 64-char random string
- [ ] `DJANGO_DEBUG=0`
- [ ] HTTPS in front (Caddy / Nginx with Let's Encrypt)
- [ ] Postgres + Redis not exposed to the public internet (drop the host port
      mappings in compose for prod)
- [ ] Strong dev password rotated; owners pick their own from the invite link
- [ ] Backups tested (restore drill)
- [ ] `SENDGRID_*` + `TWILIO_*` rotated to live credentials
- [ ] S3 bucket has appropriate lifecycle / encryption rules
- [ ] Audit log reviewed weekly for anomalous activity

---

## 11. Managed deployment: Cloud Run + Supabase + Vercel

This is the setup used for the hosted test environment.

| Piece | Where | Notes |
| --- | --- | --- |
| Web (Next.js) | Vercel project `versuitality-monorepo-web` | `NEXT_PUBLIC_API_BASE_URL` points at the API |
| API (Django + Channels) | Cloud Run service `versuitality-api`, project `versuitality` | built from `apps/api/Dockerfile` |
| Database | Supabase Postgres | TLS required (`POSTGRES_SSLMODE=require`) |
| Secrets | Secret Manager | `versuitality-django-secret`, `versuitality-db-password`, `versuitality-seed-owner-password` |

### Deploy / redeploy the API

From **Google Cloud Shell** (already signed in to gcloud):

```bash
git clone https://github.com/omverma1810/versuitality-monorepo
cd versuitality-monorepo
bash deploy/gcp/deploy-api.sh      # prompts (hidden) for the DB and owner passwords
```

The script enables the APIs, stores the passwords in Secret Manager, builds and
deploys the container, runs a one-off Cloud Run Job that creates the three owner
accounts, then checks `/api/health/` and `/api/readiness/`. Re-running it is safe:
migrations run on container start (`entrypoint.prod.sh`, never `makemigrations`),
the Django secret is kept, and existing owners are skipped. Set `SEED_DEMO=1` to
also load demo data, `SKIP_SEED=1` to skip account creation.

Cloud Run serves the service on two equivalent URLs: the deterministic
`https://<service>-<project-number>.<region>.run.app` and the hashed one printed by
`gcloud run services describe` (`https://versuitality-api-<hash>-el.a.run.app`).

The web app finds the API through the **Vercel project environment variable
`NEXT_PUBLIC_API_BASE_URL`** (Settings -> Environment Variables, Production and
Preview). Next.js bakes it into the bundle at build time, so redeploy the web app
after changing it. Do not use an `env` block in `vercel.json` for this -- it is not
applied at build time and the app silently falls back to `http://localhost:8000`.
The API must also allow the web origin: `DJANGO_CORS_ORIGINS` /
`DJANGO_CSRF_TRUSTED_ORIGINS` default to the project's Vercel aliases; to add one
without redeploying use `gcloud run services update versuitality-api --region
asia-south1 --update-env-vars '^|^DJANGO_CORS_ORIGINS=a,b|DJANGO_CSRF_TRUSTED_ORIGINS=a,b'`.

### Supabase connection gotchas

* The direct host `db.<ref>.supabase.co` is **IPv6-only** on most projects and Cloud
  Run egresses over IPv4. If `/api/readiness/` reports `Network is unreachable`,
  use the **Session pooler** from Supabase -> Connect: host
  `aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`, port 5432
  (`DB_HOST=... DB_USER=... bash deploy/gcp/deploy-api.sh`).
* Only use the port-6543 *transaction* pooler with `DB_POOLER_MODE=transaction`
  (disables server-side cursors and prepared statements).
* Choose a Cloud Run `REGION` near the Supabase region to keep query latency low.

### Known limits of this setup

* **One instance** (`--max-instances 1`): live board updates use the in-process
  channel layer. To scale out set `REDIS_URL` (e.g. Upstash/Memorystore) and raise it.
* **Uploads are ephemeral**: cloth images live on the container disk and are lost on
  redeploy/restart. Move `MEDIA` to object storage (GCS bucket via `django-storages`)
  before relying on them.
* `--min-instances 1` keeps WebSockets and uploads alive between requests; it has an
  idle cost. Use `0` for a cheaper, cold-start-prone test setup.
* Notifications stay on the console provider until SendGrid/Twilio secrets are added
  as Cloud Run secrets (`SENDGRID_API_KEY`, `TWILIO_*`) -- see section 4.
* Rotate the Supabase password after testing: change it in Supabase, run
  `gcloud secrets versions add versuitality-db-password --data-file=-`, then redeploy.
