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

# Clerk organizer auth (optional, sticky). Provide keys via env or ./.clerk-env
# (gitignored). With both keys set, organizer sign-in is enabled; without them
# the app deploys in OPEN mode (no sign-in — anyone can create/manage events).
# See CLERK_SETUP.md for how to get the keys and configure sign-in methods.
if [ -f .clerk-env ]; then
  # shellcheck disable=SC1091
  source ./.clerk-env
fi
if [ -n "${CLERK_SECRET_KEY:-}" ] && [ -n "${CLERK_PUBLISHABLE_KEY:-}" ]; then
  {
    printf 'export CLERK_PUBLISHABLE_KEY=%q\n' "$CLERK_PUBLISHABLE_KEY"
    printf 'export CLERK_SECRET_KEY=%q\n' "$CLERK_SECRET_KEY"
    printf 'export SUPER_ADMIN_IDS=%q\n' "${SUPER_ADMIN_IDS:-}"
  } > .clerk-env
  export CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY SUPER_ADMIN_IDS
  bold "  Organizer auth: ON (Clerk keys loaded from ./.clerk-env)."
else
  printf "\033[33m%s\033[0m\n" "  ⚠ Clerk keys not set — deploying in OPEN mode (no organizer sign-in)."
  printf "\033[33m%s\033[0m\n" "    Set CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY (see CLERK_SETUP.md) and re-run to enable."
fi

# Custom domain (optional, sticky). With DOMAIN set (or ./.domain saved), the app
# is served on that apex + www via a Route 53 alias and an ACM cert (us-east-1),
# instead of the default *.cloudfront.net. Requires a Route 53 hosted zone for the
# domain whose nameservers the registrar already delegates to (see DEPLOY.md).
if [ -n "${DOMAIN:-}" ]; then
  DOMAIN=$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')
  printf '%s\n' "$DOMAIN" > .domain
elif [ -f .domain ]; then
  DOMAIN=$(tr -d '[:space:]' < .domain | tr '[:upper:]' '[:lower:]')
else
  DOMAIN=""
fi

HOSTED_ZONE_ID=""
if [ -n "$DOMAIN" ]; then
  HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" \
    --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" --output text 2>/dev/null | sed 's#/hostedzone/##')
  if [ -z "$HOSTED_ZONE_ID" ] || [ "$HOSTED_ZONE_ID" = "None" ]; then
    fail "No Route 53 hosted zone for $DOMAIN. Create one (aws route53 create-hosted-zone --name $DOMAIN …) and delegate your registrar's nameservers to it, or unset DOMAIN."
  fi

  # Preflight: confirm the registrar actually delegates to this Route 53 zone.
  # If not, ACM's DNS validation would hang for hours, so bail early with the
  # exact nameservers to set. Skipped if `dig` isn't installed, or if
  # NS_PREFLIGHT=skip is set. We check the *registry* (parent-TLD) delegation
  # rather than a recursive resolver, so a stale public-resolver cache (up to an
  # hour after the switch) doesn't produce a false "not delegated" — ACM/Clerk
  # follow the authoritative delegation, which is what this checks.
  if command -v dig >/dev/null 2>&1 && [ "${NS_PREFLIGHT:-}" != "skip" ]; then
    ZONE_NS=$(aws route53 get-hosted-zone --id "$HOSTED_ZONE_ID" --query 'DelegationSet.NameServers' --output text 2>/dev/null)
    PARENT_NS=$(dig +short NS "${DOMAIN#*.}." 2>/dev/null | head -1)
    if [ -n "$PARENT_NS" ]; then
      LIVE_NS=" $(dig +noall +authority +norecurse NS "$DOMAIN" @"$PARENT_NS" 2>/dev/null | awk '$4=="NS"{print $5}' | sed 's/\.$//' | tr '\n' ' ') "
    else
      LIVE_NS=" $(dig +short NS "$DOMAIN" 2>/dev/null | sed 's/\.$//' | tr '\n' ' ') "
    fi
    delegated=0
    for ns in $ZONE_NS; do
      case "$LIVE_NS" in *" ${ns%.} "*) delegated=1 ;; esac
    done
    if [ "$delegated" -ne 1 ]; then
      printf "\033[31m%s\033[0m\n" "  ✗ $DOMAIN is not yet delegated to Route 53 — nameservers haven't propagated." >&2
      printf "\033[33m%s\033[0m\n" "    Set your registrar's nameservers to:" >&2
      for ns in $ZONE_NS; do printf "      %s\n" "$ns" >&2; done
      fail "Re-run ./deploy.sh once the nameserver change has propagated (usually 15–60 min)."
    fi
  fi
  bold "  Custom domain: $DOMAIN + www (Route 53 zone $HOSTED_ZONE_ID)"
  export DOMAIN_NAME="$DOMAIN" HOSTED_ZONE_ID
else
  bold "  Custom domain: none (serving on the default CloudFront domain)."
fi

# ---- install -----------------------------------------------------------------
bold "▶ Installing dependencies (first run takes a few minutes)…"
npm install --silent
( cd backend  && npm install --silent )
( cd frontend && npm install --silent )
( cd infra    && npm install --silent )

# ---- bootstrap + deploy infra ------------------------------------------------
bold "▶ Preparing your AWS account for CDK (one-time bootstrap)…"
( cd infra && npx cdk bootstrap "aws://$ACCOUNT/$REGION" >/dev/null )
if [ -n "$DOMAIN" ] && [ "$REGION" != "us-east-1" ]; then
  # CloudFront certs must live in us-east-1, so that region needs bootstrapping too.
  ( cd infra && npx cdk bootstrap "aws://$ACCOUNT/us-east-1" >/dev/null )
fi

# In custom-domain mode, issue the cert first (us-east-1) and feed its ARN to the
# main stack. The cert validates against the Route 53 zone; the preflight above
# already confirmed delegation, so this shouldn't stall.
if [ -n "$DOMAIN" ]; then
  bold "▶ Issuing the TLS certificate for $DOMAIN (us-east-1, DNS-validated)…"
  ( cd infra && npx cdk deploy TomorrowStoriesCert --require-approval never --outputs-file cert-outputs.json )
  CERT_ARN=$(node -e "console.log(require('./infra/cert-outputs.json').TomorrowStoriesCert.CertificateArn)")
  export CERT_ARN
  bold "  Certificate ready: $CERT_ARN"
fi

bold "▶ Deploying cloud infrastructure (this is the long step)…"
( cd infra && npx cdk deploy TomorrowStories --require-approval never --outputs-file cdk-outputs.json )

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
echo "   Organizer dashboard:          $SITE_URL/admin"
if [ -n "${CLERK_SECRET_KEY:-}" ]; then
  echo "   Organizer auth:               ON (Clerk — sign in to create/manage)"
else
  echo "   Organizer auth:               OFF (open mode — legacy admin password below)"
  echo "   Admin password:               $ADMIN_KEY"
fi
if [ -n "$DOMAIN" ]; then
  echo "   Custom domain:                $DOMAIN + www.$DOMAIN  (Route 53 alias → CloudFront, ACM TLS)"
fi
echo "   Transcode mode:               ${TRANSCODE}  (sticky — saved in ./.transcode-mode; set TRANSCODE=on|off to change)"
echo "   (Secrets saved in ./.admin-key and ./.clerk-env — keep them private.)"
echo "   (Create an event → it opens the big screen with a live QR code.)"
echo
echo "   The QR on the big screen now points at the real site, so phones can scan"
echo "   it and upload. It can take a few minutes for CloudFront to warm up."
