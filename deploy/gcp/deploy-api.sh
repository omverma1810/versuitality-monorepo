#!/usr/bin/env bash
# Deploy the Versuitality API to Google Cloud Run, using Supabase for Postgres.
#
# Run it from Google Cloud Shell (gcloud is already signed in there):
#
#   git clone https://github.com/omverma1810/versuitality-monorepo
#   cd versuitality-monorepo && bash deploy/gcp/deploy-api.sh
#
# Passwords are typed at the prompts (hidden) and stored only in Secret Manager.
# Nothing secret is written to disk, to git, or onto a command line.
#
# Every setting below can be overridden from the environment, e.g.
#   REGION=asia-south1 DB_HOST=aws-0-ap-south-1.pooler.supabase.com \
#   DB_USER=postgres.qfglbgivvlmiubnxsnbm bash deploy/gcp/deploy-api.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-versuitality}"
REGION="${REGION:-asia-south1}"          # pick the region closest to your Supabase project
SERVICE="${SERVICE:-versuitality-api}"

# Supabase Postgres. The direct host (db.<ref>.supabase.co) is IPv6-only on most
# projects and Cloud Run egresses over IPv4 -- if the readiness check below
# fails with "Network is unreachable", use the *Session pooler* values from
# Supabase -> Connect (host aws-0-<region>.pooler.supabase.com, user
# postgres.<ref>, port 5432) via DB_HOST / DB_USER.
DB_HOST="${DB_HOST:-db.qfglbgivvlmiubnxsnbm.supabase.co}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
DB_POOLER_MODE="${DB_POOLER_MODE:-}"      # set to "transaction" only for port 6543

# Browser origins allowed to call the API (CORS + WebSockets).
WEB_ORIGINS="${WEB_ORIGINS:-https://versuitality-monorepo-web.vercel.app,https://versuitality-monorepo-web-om-vermas-projects.vercel.app,https://versuitality-monorepo-web-git-master-om-vermas-projects.vercel.app}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
SECRET_DJANGO="versuitality-django-secret"
SECRET_DB="versuitality-db-password"
SECRET_SEED="versuitality-seed-owner-password"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud not found - run this in Google Cloud Shell."
[ -f "$API_DIR/Dockerfile" ] || die "Cannot find $API_DIR/Dockerfile (is this the repo root?)."

if [ -z "${DB_PASSWORD:-}" ]; then
  read -r -s -p "Supabase database password: " DB_PASSWORD; echo
fi
[ -n "$DB_PASSWORD" ] || die "A database password is required."

if [ -z "${SEED_OWNER_PASSWORD:-}" ] && [ -z "${SKIP_SEED:-}" ]; then
  read -r -s -p "Initial password for the 3 owner logins (min 8 chars; Enter to skip): " SEED_OWNER_PASSWORD; echo
fi
if [ -n "${SEED_OWNER_PASSWORD:-}" ] && [ "${#SEED_OWNER_PASSWORD}" -lt 8 ]; then
  die "Owner password must be at least 8 characters."
fi

say "Using project $PROJECT_ID, region $REGION, service $SERVICE"
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

say "Enabling required Google Cloud APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

upsert_secret() { # name value [only-if-missing]
  local name="$1" value="$2" only_missing="${3:-}"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    [ -n "$only_missing" ] && return 0
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- \
      --replication-policy=automatic >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member "serviceAccount:$RUNTIME_SA" --role roles/secretmanager.secretAccessor >/dev/null
}

say "Storing secrets in Secret Manager"
# The Django key is created once and then kept, so redeploys don't log everyone out.
upsert_secret "$SECRET_DJANGO" "$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')" only-if-missing
gcloud secrets add-iam-policy-binding "$SECRET_DJANGO" \
  --member "serviceAccount:$RUNTIME_SA" --role roles/secretmanager.secretAccessor >/dev/null
upsert_secret "$SECRET_DB" "$DB_PASSWORD"
[ -n "${SEED_OWNER_PASSWORD:-}" ] && upsert_secret "$SECRET_SEED" "$SEED_OWNER_PASSWORD"

say "Granting the build/runtime service account its roles"
# Source deploys build as the default compute service account. Newer projects no
# longer give it these roles, and the build then fails with "default service
# account is missing required IAM permissions" / "could not resolve source".
grant_role() { # role required|optional
  if ! gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member "serviceAccount:$RUNTIME_SA" --role "$1" --condition=None >/dev/null; then
    if [ "$2" = required ]; then
      die "Could not grant $1 to $RUNTIME_SA. You need Owner (or Project IAM Admin) on $PROJECT_ID."
    fi
    echo "  (skipped optional role $1)"
  fi
}
for role in roles/cloudbuild.builds.builder roles/storage.objectViewer \
            roles/artifactregistry.writer roles/logging.logWriter; do
  grant_role "$role" required
done
grant_role roles/run.builder optional
echo "Waiting 40s for IAM changes to propagate..."
sleep 40

DB_ENV="POSTGRES_HOST=$DB_HOST|POSTGRES_PORT=$DB_PORT|POSTGRES_USER=$DB_USER|POSTGRES_DB=$DB_NAME|POSTGRES_SSLMODE=require"
[ -n "$DB_POOLER_MODE" ] && DB_ENV="$DB_ENV|POSTGRES_POOLER_MODE=$DB_POOLER_MODE"
FIRST_ORIGIN="${WEB_ORIGINS%%,*}"
SERVICE_ENV="DJANGO_DEBUG=0|DJANGO_TRUST_ALL_HOSTS=1|SERVE_MEDIA_FROM_APP=1|$DB_ENV|DJANGO_CORS_ORIGINS=$WEB_ORIGINS|DJANGO_CSRF_TRUSTED_ORIGINS=$WEB_ORIGINS|WEB_BASE_URL=$FIRST_ORIGIN"
SECRETS="DJANGO_SECRET_KEY=$SECRET_DJANGO:latest,POSTGRES_PASSWORD=$SECRET_DB:latest"

say "Building and deploying $SERVICE (first build takes a few minutes)"
# One instance on purpose: live board updates use the in-process channel layer,
# and uploaded images live on that instance's disk. Add Redis + object storage
# (see OPERATIONS.md) before scaling out.
gcloud run deploy "$SERVICE" \
  --source "$API_DIR" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 --max-instances 1 \
  --cpu 1 --memory 1Gi --cpu-boost \
  --timeout 3600 \
  --set-env-vars "^|^$SERVICE_ENV" \
  --set-secrets "$SECRETS" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"

if [ -n "${SEED_OWNER_PASSWORD:-}" ]; then
  say "Creating the owner accounts (one-off job)"
  IMAGE="$(gcloud run services describe "$SERVICE" --region "$REGION" \
    --format='value(spec.template.spec.containers[0].image)')"
  gcloud run jobs deploy "$SERVICE-seed" \
    --image "$IMAGE" --region "$REGION" \
    --command python --args "manage.py,seed_owners" \
    --set-env-vars "^|^DJANGO_DEBUG=0|$DB_ENV" \
    --set-secrets "$SECRETS,SEED_OWNER_PASSWORD=$SECRET_SEED:latest" \
    --max-retries 0 --task-timeout 600 --quiet
  gcloud run jobs execute "$SERVICE-seed" --region "$REGION" --wait
  if [ "${SEED_DEMO:-}" = "1" ]; then
    say "Loading demo data"
    gcloud run jobs execute "$SERVICE-seed" --region "$REGION" --args "manage.py,seed_demo" --wait
  fi
fi

say "Checking the live service"
echo "Service URL: $URL"
curl -sS --max-time 30 "$URL/api/health/" || true; echo
READY_CODE="$(curl -sS -o /tmp/vs-ready.json -w '%{http_code}' --max-time 30 "$URL/api/readiness/" || echo 000)"
cat /tmp/vs-ready.json 2>/dev/null || true; echo
if [ "$READY_CODE" != "200" ]; then
  cat <<EOF

Readiness returned HTTP $READY_CODE, so the API cannot reach the database.
  * "Network is unreachable" / IPv6 errors -> use the Supabase *Session pooler*
    host and user (see the top of this script) and re-run.
  * "password authentication failed"      -> re-run and re-enter the password.
Logs:  gcloud run services logs read $SERVICE --region $REGION --limit 50
EOF
  exit 1
fi

cat <<EOF

API is live:  $URL
(also served at https://${SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app -- both URLs work)

The web app reads the API address from the NEXT_PUBLIC_API_BASE_URL environment
variable of the Vercel project (Settings -> Environment Variables). It must be
$URL
and the web app must be redeployed after any change, because Next.js bakes it in
at build time. (An "env" block in vercel.json is NOT applied at build time.)

Sign in with  sirish@versuitality.com / tripti@versuitality.com / rahul@versuitality.com
using the owner password you entered. Rotate the Supabase password when testing is done.
EOF
