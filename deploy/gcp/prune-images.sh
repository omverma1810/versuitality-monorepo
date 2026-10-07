#!/usr/bin/env bash
# Keep only the newest N container images (and Cloud Run revisions) so storage
# costs stay flat. Safe to run any time; it never touches the revision that is
# currently serving traffic or the image it runs.
#
#   PROJECT_ID=versuitality REGION=asia-south1 bash deploy/gcp/prune-images.sh
#   DRY_RUN=1 bash deploy/gcp/prune-images.sh      # just print what would go
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-versuitality}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-versuitality-api}"
AR_REPO="${AR_REPO:-versuitality}"
KEEP="${KEEP_IMAGES:-3}"
DRY_RUN="${DRY_RUN:-0}"

# Repositories to prune: the CI repo, plus the one `gcloud run deploy --source` created.
REPOS=("${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}" "${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy")

run() { if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] $*"; else "$@"; fi; }

# Digest of the image the live revision uses (never delete it).
LIVE_REV=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --format='value(status.traffic[0].revisionName)' 2>/dev/null || true)
LIVE_IMAGE=$(gcloud run revisions describe "$LIVE_REV" --region "$REGION" --project "$PROJECT_ID" \
  --format='value(spec.containers[0].image)' 2>/dev/null || true)
LIVE_DIGEST="${LIVE_IMAGE##*@}"

echo "Keeping the newest $KEEP images per package; live image: ${LIVE_IMAGE:-unknown}"

for repo in "${REPOS[@]}"; do
  gcloud artifacts repositories describe "${repo##*/}" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1 || { echo "skip $repo (not found)"; continue; }
  # One row per image package in the repo.
  for pkg in $(gcloud artifacts docker images list "$repo" --project "$PROJECT_ID" --format='value(package)' | sort -u); do
    echo "== $pkg"
    # Newest first: "<digest> <create_time>"
    mapfile -t rows < <(gcloud artifacts docker images list "$pkg" --project "$PROJECT_ID" \
      --include-tags --sort-by=~CREATE_TIME --format='value(version)')
    idx=0
    for digest in "${rows[@]}"; do
      idx=$((idx + 1))
      if [ "$idx" -le "$KEEP" ]; then echo "keep   $digest"; continue; fi
      if [ -n "$LIVE_DIGEST" ] && [ "$digest" = "$LIVE_DIGEST" ]; then echo "keep   $digest (live)"; continue; fi
      echo "delete $digest"
      run gcloud artifacts docker images delete "${pkg}@${digest}" --project "$PROJECT_ID" --delete-tags --quiet || echo "  (could not delete $digest, continuing)"
    done
  done
done

# Old Cloud Run revisions: keep the newest $KEEP; the serving one cannot be deleted anyway.
echo "== Cloud Run revisions of $SERVICE"
mapfile -t revs < <(gcloud run revisions list --service "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --sort-by=~metadata.creationTimestamp --format='value(metadata.name)')
idx=0
for rev in "${revs[@]}"; do
  idx=$((idx + 1))
  if [ "$idx" -le "$KEEP" ] || [ "$rev" = "$LIVE_REV" ]; then echo "keep   $rev"; continue; fi
  echo "delete $rev"
  run gcloud run revisions delete "$rev" --region "$REGION" --project "$PROJECT_ID" --quiet || echo "  (could not delete $rev, continuing)"
done
echo "Prune complete."
