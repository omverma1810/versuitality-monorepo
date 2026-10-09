#!/usr/bin/env bash
# One-time setup so GitHub Actions can deploy the API to Cloud Run *without any
# stored key* (Workload Identity Federation), and so old container images are
# cleaned up automatically.
#
# Run it once in Google Cloud Shell:
#
#   git clone https://github.com/omverma1810/versuitality-monorepo
#   cd versuitality-monorepo && bash deploy/gcp/setup-github-deploy.sh
#
# Safe to re-run; every step checks whether it is already done. At the end it
# prints the two values to paste into GitHub (Settings > Secrets and variables
# > Actions > Variables).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-versuitality}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-versuitality-api}"
AR_REPO="${AR_REPO:-versuitality}"
GITHUB_REPO="${GITHUB_REPO:-omverma1810/versuitality-monorepo}"
GITHUB_BRANCH="${GITHUB_BRANCH:-master}"
POOL="github"
PROVIDER="github-actions"
DEPLOY_SA_NAME="github-deployer"
KEEP_IMAGES="${KEEP_IMAGES:-3}"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
command -v gcloud >/dev/null || die "gcloud not found - run this in Google Cloud Shell."

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEPLOY_SA="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

say "Enabling the APIs the pipeline needs"
WANTED="iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com artifactregistry.googleapis.com run.googleapis.com secretmanager.googleapis.com"
ENABLED="$(gcloud services list --enabled --format='value(config.name)' 2>/dev/null || true)"
MISSING=""
for api in $WANTED; do echo "$ENABLED" | grep -qx "$api" || MISSING="$MISSING $api"; done
if [ -z "$MISSING" ]; then
  echo "  all required APIs are already enabled"
else
  # Google rate-limits API enablement (HTTP 429); retry politely.
  for attempt in 1 2 3 4 5 6; do
    # shellcheck disable=SC2086
    if gcloud services enable $MISSING >/dev/null 2>&1; then echo "  enabled:$MISSING"; break; fi
    [ "$attempt" = 6 ] && die "Could not enable:$MISSING (rate-limited?). Wait a few minutes and re-run."
    echo "  rate-limited, retrying in 30s (attempt $attempt/6)..."; sleep 30
  done
fi

# --------------------------------------------------------------- Artifact Registry
say "Artifact Registry repository '$AR_REPO' (Docker) in $REGION"
if ! gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" --repository-format docker --location "$REGION" \
    --description "Versuitality API images (CI/CD)"
fi

say "Cleanup policy: keep only the $KEEP_IMAGES most recent versions, delete everything older"
POLICY_FILE="$(mktemp)"
cat > "$POLICY_FILE" <<JSON
[
  {"name": "keep-newest-${KEEP_IMAGES}", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": ${KEEP_IMAGES}}},
  {"name": "delete-the-rest", "action": {"type": "Delete"}, "condition": {"tagState": "any"}}
]
JSON
for repo in "$AR_REPO" cloud-run-source-deploy; do
  if gcloud artifacts repositories describe "$repo" --location "$REGION" >/dev/null 2>&1; then
    gcloud artifacts repositories set-cleanup-policies "$repo" --location "$REGION" --policy "$POLICY_FILE" --no-dry-run
    echo "  policy applied to $repo"
  fi
done
rm -f "$POLICY_FILE"

say "Expire old build-source uploads after 7 days (tiny, but free to tidy)"
SRC_BUCKET="gs://run-sources-${PROJECT_ID}-${REGION}"
if gcloud storage buckets describe "$SRC_BUCKET" >/dev/null 2>&1; then
  LC_FILE="$(mktemp)"
  echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":7}}]}' > "$LC_FILE"
  gcloud storage buckets update "$SRC_BUCKET" --lifecycle-file "$LC_FILE" >/dev/null
  rm -f "$LC_FILE"
  echo "  lifecycle rule set on $SRC_BUCKET"
else
  echo "  no $SRC_BUCKET bucket - nothing to do"
fi

# ----------------------------------------------------------------- Deploy identity
say "Service account for deployments: $DEPLOY_SA"
if ! gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOY_SA_NAME" --display-name "GitHub Actions deployer"
  sleep 10
fi

say "Granting it the minimum roles"
# Deploy + route traffic + delete old revisions.
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOY_SA" \
  --role roles/run.admin --condition=None >/dev/null
# Push images and delete the old ones (this repo only).
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location "$REGION" \
  --member "serviceAccount:$DEPLOY_SA" --role roles/artifactregistry.repoAdmin >/dev/null
if gcloud artifacts repositories describe cloud-run-source-deploy --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories add-iam-policy-binding cloud-run-source-deploy --location "$REGION" \
    --member "serviceAccount:$DEPLOY_SA" --role roles/artifactregistry.repoAdmin >/dev/null
fi
# Cloud Run may only run revisions as the runtime identity if the deployer may "act as" it.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member "serviceAccount:$DEPLOY_SA" --role roles/iam.serviceAccountUser >/dev/null

# --------------------------------------------------- Workload Identity Federation
say "Workload Identity pool + GitHub provider (keyless auth)"
if ! gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
fi
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub Actions OIDC" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '${GITHUB_REPO}' && assertion.ref == 'refs/heads/${GITHUB_BRANCH}'"
fi

say "Allowing ONLY ${GITHUB_REPO}@${GITHUB_BRANCH} to act as the deployer"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" >/dev/null

PROVIDER_PATH="$(gcloud iam workload-identity-pools providers describe "$PROVIDER" --location global --workload-identity-pool "$POOL" --format='value(name)')"

say "Optional: first prune right now (keeps the newest $KEEP_IMAGES images and revisions)"
if gcloud run services describe "$SERVICE" --region "$REGION" >/dev/null 2>&1; then
  PROJECT_ID="$PROJECT_ID" REGION="$REGION" SERVICE="$SERVICE" AR_REPO="$AR_REPO" KEEP_IMAGES="$KEEP_IMAGES" \
    bash "$(dirname "${BASH_SOURCE[0]}")/prune-images.sh" || echo "  (prune skipped)"
fi

cat <<EOF

Done. Add these two *variables* in GitHub:
  Repo > Settings > Secrets and variables > Actions > Variables > New repository variable

  GCP_WORKLOAD_IDENTITY_PROVIDER = ${PROVIDER_PATH}
  GCP_SERVICE_ACCOUNT            = ${DEPLOY_SA}

(They are identifiers, not secrets - no key or password exists anywhere.)
Then every push to ${GITHUB_BRANCH} that passes CI deploys itself.
EOF
