# Deploying Tomorrow Stories

Two ways to run it:

- **Demo (no AWS)** — the whole app on seeded, in-memory data. Great for a look.
- **Full AWS deploy** — real uploads, MediaConvert transcode, CloudFront hosting.

```
frontend/   React + Vite SPA (attendee app + big screen)
backend/    Lambda handlers (API, transcode start, transcode complete)
infra/      AWS CDK (TypeScript) — all the cloud resources
```

---

## 1. Run the demo locally

```bash
cd frontend
npm install
VITE_DEMO=1 npm run dev
```

Open the printed URL:
- `/` — create/join an event
- `/e/demo` — attendee app on seeded data
- `/e/demo/big` — big screen

No backend needed; uploads and likes are simulated in-memory.

---

## 2. Full AWS deploy

### Prerequisites
- An AWS account + credentials configured (`aws configure`).
- Node 20+.
- CDK bootstrapped in your target account/region (once per account/region):
  ```bash
  cd infra && npm install && npx cdk bootstrap
  ```
- **MediaConvert** and the CloudFront/OAC features used here are available in all
  standard commercial regions. Default is `ap-southeast-2` (Sydney); it deploys
  to whatever region your AWS CLI is set to (`aws configure get region`).

### Step 1 — install workspaces
```bash
# from the repo root
npm install            # root esbuild (used by CDK to bundle Lambdas)
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
cd infra    && npm install && cd ..
```

### Step 2 — deploy the infrastructure
```bash
cd infra
npx cdk deploy
```
This creates DynamoDB, the three S3 buckets, CloudFront, the HTTP API, the three
Lambdas, the MediaConvert role, and the EventBridge rule. It prints outputs:

```
TomorrowStories.SiteUrl        = https://dXXXX.cloudfront.net
TomorrowStories.ApiUrl         = https://XXXX.execute-api.ap-southeast-2.amazonaws.com
TomorrowStories.WebBucketName  = tomorrowstories-webXXXX
TomorrowStories.DistributionId = EXXXXXXXX
```

CDK also writes `config.json` (`{ "apiUrl": ... }`) into the web bucket, so the
SPA discovers the API at runtime — you do **not** need to rebuild the frontend
when the API URL changes.

### Step 3 — build & upload the frontend
```bash
cd ../frontend
npm run build
aws s3 sync dist "s3://<WebBucketName>" --exclude config.json
# refresh the CDN
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```
> Note: don't sync with `--delete` (it would remove the CDK-managed `config.json`).
> Excluding `config.json` keeps the API URL that CDK wrote.

### Step 4 — use it
- Organizer: open `SiteUrl`, **Create event** → lands on the big screen with a QR.
- Put the big screen on the projector.
- Attendees scan the QR → `/e/<eventId>` → record/upload a clip.
- The clip uploads to S3 → MediaConvert makes a 720p MP4 + poster → it flips to
  `live` and appears on the wall and big screen within a few seconds (polling).

### Tear down
```bash
cd infra && npx cdk destroy
```
The DynamoDB table and the **media** bucket are `RemovalPolicy.RETAIN` (with
DynamoDB PITR), so event/video data **survives redeploys and even `cdk destroy`** —
you won't lose previously created events or uploaded clips. The web + raw-upload
buckets are disposable (`autoDeleteObjects` + `DESTROY`). After a `destroy`, the
retained table + media bucket are left in your account as orphans; delete them by
hand if you truly want a clean slate (or empty them — see "fresh start" below).

**Fresh start (wipe data, keep infra + URLs):** delete every item in the table and
empty the raw/media buckets. This keeps the same CloudFront/API URLs and the
resilient (RETAIN) resources, just with no content:
```bash
aws dynamodb scan --table-name <TableName> --projection-expression 'PK,SK' \
  --query 'Items[*].[PK.S,SK.S]' --output text | while read -r PK SK; do
  aws dynamodb delete-item --table-name <TableName> \
    --key "{\"PK\":{\"S\":\"$PK\"},\"SK\":{\"S\":\"$SK\"}}"; done
aws s3 rm "s3://<MediaBucketName>" --recursive
aws s3 rm "s3://<RawBucketName>"   --recursive
```

---

## Organizer console (all sessions)

`/<site>/admin` lists every session and its links (attendee + big screen + code),
so if someone forgets their event you can look it up. It's gated by a shared
password:

- `deploy.sh` generates a long random password on first deploy, saves it to
  `./.admin-key` (gitignored), and prints it + the admin URL at the end.
- To set your own instead: `ADMIN_PASSWORD='your-long-password' ./deploy.sh`.
- Leave `ADMIN_PASSWORD` empty to disable the console entirely (the endpoint 404s).

This is lightweight obscurity (one shared secret), fine for looking up links —
not a hardened admin system.

## Exporting the wall after the event

Give the client a downloadable package — a self-contained **HTML wall** that looks
like the app plus the raw **MP4** files they can open directly. Run the export
tool (no dependencies, Node 18+):

```bash
node tools/export-wall.mjs --site https://<your-cloudfront-domain> --event <eventId> --out ./wall-export
```

It reads the event's videos, downloads each MP4 + poster, and writes:

```
wall-export/
├── index.html      # open in any browser — the branded wall, works offline
├── videos/*.mp4    # the raw clips, playable directly
├── posters/*.jpg
└── README.txt
```

Zip `wall-export/` and hand it over. (You can pass `--api <ApiUrl>` instead of
`--site` if you have the API URL directly.)

## Troubleshooting uploads ("stuck processing")

A clip goes: **upload → S3 → MediaConvert transcode → live**. For a short clip
that whole chain is normally well under a minute. If a clip sits on
"Processing…" much longer, the transcode chain broke — run:

```bash
./tools/diagnose.sh
```

It prints recent MediaConvert jobs (with any **error message**) and the two
transcode Lambdas' logs, which pinpoints where it stalled:
- **Job in ERROR** → the Error column says why (bad input/settings).
- **No jobs at all** → `onRawUpload` didn't start one (see its logs / the S3
  trigger).
- **Job COMPLETE but still "processing"** → `onTranscodeDone` didn't flip it.

**`SubscriptionRequiredException`** from MediaConvert means the whole **account**
isn't entitled to MediaConvert (common on restricted/internal accounts). No code
fixes that — either deploy to a standard AWS account, or run in **no-transcode
mode**, which skips MediaConvert entirely:

```bash
TRANSCODE=off ./deploy.sh
```

In no-transcode mode, uploads go straight to the media bucket and appear on the
wall immediately — no processing step. Trade-off: the original file's codec must
play in the viewer's browser. H.264 clips play everywhere; iPhone **HEVC** clips
may not play on some Android/desktop browsers (set iPhone → Settings → Camera →
Formats → **Most Compatible** to record H.264). For a proper cross-device event,
prefer transcode (the default) on a MediaConvert-capable account.

Resilience built in: if `onRawUpload` can't start a job, it now marks the clip
**failed** (the card shows a clear failed state) instead of spinning forever.
The job itself is a single 720p MP4 output — kept minimal so there's little to
go wrong. Locking your phone mid-upload doesn't affect server-side processing;
it continues regardless.

## Configuration knobs

| Where | What |
|-------|------|
| `backend/src/shared/config.ts` `DEFAULT_THEMES` | The six conference themes. |
| `infra/.../onRawUpload.ts` (720p, QVBR 7, 3 Mbps) | Transcode quality/bitrate. |
| `RawUploads` lifecycle (`3 days`) | How long phone originals are kept. |
| `useEventData` poll interval | Wall/big-screen refresh cadence. |
| API `MAX_BYTES` (200 MB) | Upload size cap. |

---

## Security note (v1)

There is **no login**. Access is scoped by the unguessable `eventId` in the QR
link — see `ARCHITECTURE.md` → *Security model*. This is right for a public
conference wall, but it is obscurity, not privacy. Don't use v1 for sensitive
content. v2 upgrades: organizer passcode + the moderation queue + signed URLs.
