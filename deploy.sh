#!/usr/bin/env bash
#
# One-shot deploy for Tomorrow Stories.
# Run from the project root on a machine logged into your AWS account:
#     ./deploy.sh
#
# It installs deps, deploys the AWS infrastructure (CDK), builds the frontend,
# uploads it, and prints your live URLs. Safe to re-run — it just updates.

set -euo pipefail
cd "$(dirname "$0")"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
fail() { printf "\033[31m%s\033[0m\n" "$1" >&2; exit 1; }

# ---- prerequisites -----------------------------------------------------------
bold "▶ Checking prerequisites…"
command -v node >/dev/null || fail "Node.js is not installed. Get it from https://nodejs.org (LTS)."
command -v npm  >/dev/null || fail "npm is not installed (comes with Node.js)."
command -v aws  >/dev/null || fail "AWS CLI is not installed. See https://aws.amazon.com/cli/"

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  fail "AWS credentials aren't configured. Run:  aws configure   (then re-run ./deploy.sh)"
fi
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "ap-southeast-2")  # default: Sydney
export AWS_DEFAULT_REGION="$REGION"
bold "  Using AWS account $ACCOUNT in region $REGION"

# Admin-console password: generated once, persisted locally (.admin-key is
# gitignored) so it stays stable across redeploys.
if [ -f .admin-key ]; then
  ADMIN_KEY=$(cat .admin-key)
else
  ADMIN_KEY=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
  echo "$ADMIN_KEY" > .admin-key
  bold "  Generated an admin password → saved to ./.admin-key"
fi
export ADMIN_PASSWORD="$ADMIN_KEY"

# Transcode mode. MediaConvert isn't entitled on every account (restricted /
# internal accounts return SubscriptionRequiredException), so the mode is sticky
# to avoid a bare re-run silently reverting to a broken transcode pipeline:
#   - an explicit TRANSCODE=on|off on the command line always wins, and is saved;
#   - otherwise reuse the last mode, persisted in ./.transcode-mode;
#   - otherwise default to "on".
# Then a preflight confirms MediaConvert actually works when "on" is requested;
# if it doesn't, fall back to no-transcode so uploads serve originals instead of
# hanging on "Processing…" forever.
if [ -n "${TRANSCODE:-}" ]; then
  TRANSCODE=$(printf '%s' "$TRANSCODE" | tr '[:upper:]' '[:lower:]')
elif [ -f .transcode-mode ]; then
  TRANSCODE=$(tr -d '[:space:]' < .transcode-mode | tr '[:upper:]' '[:lower:]')
else
  TRANSCODE=on
fi

if [ "$TRANSCODE" = "off" ]; then
  bold "  Transcode mode: off (no MediaConvert — originals served directly)."
elif aws mediaconvert describe-endpoints --max-results 1 >/dev/null 2>&1; then
  bold "  Transcode mode: on (MediaConvert reachable)."
else
  printf "\033[33m%s\033[0m\n" "  ⚠ MediaConvert isn't available on this account — using no-transcode mode."
  printf "\033[33m%s\033[0m\n" "    (Uploads are served as-is. Move to a MediaConvert-capable account and re-run with TRANSCODE=on to enable transcoding.)"
  TRANSCODE=off
fi
export TRANSCODE
printf '%s\n' "$TRANSCODE" > .transcode-mode

# ---- install -----------------------------------------------------------------
bold "▶ Installing dependencies (first run takes a few minutes)…"
npm install --silent
( cd backend  && npm install --silent )
( cd frontend && npm install --silent )
( cd infra    && npm install --silent )

# ---- bootstrap + deploy infra ------------------------------------------------
bold "▶ Preparing your AWS account for CDK (one-time bootstrap)…"
( cd infra && npx cdk bootstrap "aws://$ACCOUNT/$REGION" >/dev/null )

bold "▶ Deploying cloud infrastructure (this is the long step)…"
( cd infra && npx cdk deploy --require-approval never --outputs-file cdk-outputs.json )

# ---- read stack outputs ------------------------------------------------------
OUTS="infra/cdk-outputs.json"
read_out() { node -e "console.log(require('./$OUTS').TomorrowStories.$1)"; }
WEB_BUCKET=$(read_out WebBucketName)
DIST_ID=$(read_out DistributionId)
SITE_URL=$(read_out SiteUrl)

# ---- build + upload the frontend --------------------------------------------
bold "▶ Building the web app…"
( cd frontend && npm run build --silent )

bold "▶ Uploading the web app to S3…"
# Fingerprinted assets (unique filename per build) can cache forever…
# --delete prunes old build files; --exclude config.json protects the API URL
# that CDK wrote into the bucket (excluded files are never deleted).
aws s3 sync frontend/dist "s3://$WEB_BUCKET" --delete --exclude config.json \
  --exclude index.html --exclude sw.js --exclude manifest.json \
  --cache-control "public,max-age=31536000,immutable" --quiet
# …but the entry points must always revalidate, so a redeploy shows up instantly
# instead of a stale cached copy on people's phones.
aws s3 cp frontend/dist/index.html "s3://$WEB_BUCKET/index.html" \
  --cache-control "no-cache" --content-type "text/html" --quiet
aws s3 cp frontend/dist/sw.js "s3://$WEB_BUCKET/sw.js" \
  --cache-control "no-cache" --content-type "text/javascript" --quiet
aws s3 cp frontend/dist/manifest.json "s3://$WEB_BUCKET/manifest.json" \
  --cache-control "no-cache" --content-type "application/manifest+json" --quiet

bold "▶ Refreshing the CDN…"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

# ---- done --------------------------------------------------------------------
echo
bold "✅ Deployed!"
echo "   Organizer / create an event:  $SITE_URL"
echo "   All sessions (admin):         $SITE_URL/admin"
echo "   Admin password:               $ADMIN_KEY"
echo "   Transcode mode:               ${TRANSCODE}  (sticky — saved in ./.transcode-mode; set TRANSCODE=on|off to change)"
echo "   (Password is also saved in ./.admin-key — keep it private.)"
echo "   (Create an event → it opens the big screen with a live QR code.)"
echo
echo "   The QR on the big screen now points at the real site, so phones can scan"
echo "   it and upload. It can take a few minutes for CloudFront to warm up."
