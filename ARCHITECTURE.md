# Tomorrow Stories — Architecture

A branded conference video wall. Attendees record ≤60s clips on their phones,
upload them, and they appear on a big projector screen at the venue. Built from
the Claude Design prototype in `project/` (see `chats/` for the design intent).

**v1 scope:** Attendee app + Big Screen. **No user accounts / no login.** Access
to an event's videos is scoped by an unguessable **event ID** carried in the QR
code (Kahoot-style — if you don't have the link, you don't see the event).

Uploaded phone videos are transcoded to a web-safe **720p H.264 MP4** with a
poster frame via **AWS Elemental MediaConvert**.

---

## High-level diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      CloudFront (CDN)                     │
                    │   default ──► S3 web (React SPA)                          │
   Phone (attendee) │   /media/* ──► S3 media (720p MP4 + poster)              │
   Big screen (TV)  │                                                          │
        │           └───────────────┬──────────────────────┬──────────────────┘
        │                           │                       │
        │  HTTPS (API)              │ static site           │ video playback
        ▼                           ▼                       ▼
┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐
│  API Gateway     │      │  S3: web         │     │  S3: media       │
│  (HTTP API)      │      │  (SPA build)     │     │  (processed)     │
└───────┬──────────┘      └──────────────────┘     └────────▲─────────┘
        │ proxy                                              │ writes
        ▼                                                    │
┌──────────────────┐   presigned POST    ┌──────────────────┴─────────┐
│  Lambda: api     │────────────────────►│  S3: raw-uploads           │
│  - createEvent   │                     │  (phone originals)         │
│  - getEvent      │                     └───────────┬────────────────┘
│  - createUpload  │                                 │ ObjectCreated
│  - listVideos    │                                 ▼
│  - likeVideo     │                     ┌────────────────────────────┐
└───────┬──────────┘                     │  Lambda: onRawUpload       │
        │                                │  starts MediaConvert job   │
        │ read/write                     └───────────┬────────────────┘
        ▼                                            │ create job
┌──────────────────┐                                 ▼
│  DynamoDB        │◄──────────────┐     ┌────────────────────────────┐
│  single table    │   update      │     │  AWS MediaConvert          │
│  events + videos │   status=live │     │  720p MP4 + poster frame   │
└──────────────────┘               │     └───────────┬────────────────┘
                                   │                  │ Job State Change
                        ┌──────────┴───────┐          ▼
                        │ Lambda:          │  ┌────────────────────────┐
                        │ onTranscodeDone  │◄─┤ EventBridge rule       │
                        └──────────────────┘  │ (MediaConvert COMPLETE)│
                                              └────────────────────────┘
```

---

## Components

### Frontend — React + Vite (TypeScript)
Single-page app, built to static assets and served from S3 via CloudFront.

Routes:
- `/` — **Landing**: create an event (organizer) or join one by code.
- `/e/:eventId` — **Attendee** app (phone): the Wall, watch, Themes, You, and the
  upload flow (record/pick → details → review → live).
- `/e/:eventId/big` — **Big Screen**: animated wall + scan-to-upload QR + trending
  themes, for the projector at the venue.

The `:eventId` is the security boundary. It's a random, unguessable token, so the
root site shows no event's content and a random visitor can't enumerate events.

A `VITE_DEMO=1` build runs entirely on seeded mock data (no backend) so the design
can be viewed/demoed instantly — this mirrors the original prototype.

### API — API Gateway (HTTP API) + Lambda
One `api` Lambda with a tiny internal router. Routes:

| Method & path                              | Purpose                                            |
|--------------------------------------------|----------------------------------------------------|
| `POST /events`                             | Create an event; returns `eventId`, `code`, links. |
| `GET  /events/{eventId}`                   | Event metadata (name, themes).                     |
| `POST /events/{eventId}/uploads`           | Create a video record + presigned S3 POST.         |
| `GET  /events/{eventId}/videos`            | List videos for the event (wall + big screen poll).|
| `POST /events/{eventId}/videos/{id}/like`  | Atomic like increment.                             |

CORS is open (no cookies/credentials); the unguessable `eventId` is the guard.

### Storage — S3 (three buckets)
- **raw-uploads** — phone originals, written directly by the browser via a
  presigned POST. Not public. Lifecycle-expired after a few days.
- **media** — MediaConvert output (720p MP4 + JPG poster). Served through
  CloudFront `/media/*` only (Origin Access Control; bucket stays private).
- **web** — the built React SPA. Served through CloudFront default behavior.

### Transcode — MediaConvert
- `onRawUpload` (S3 `ObjectCreated` on raw-uploads) starts a MediaConvert job:
  H.264 720p MP4 output + a single frame-capture poster. `eventId`/`videoId` ride
  along in the job's `userMetadata`.
- `onTranscodeDone` (EventBridge `MediaConvert Job State Change`) flips the
  DynamoDB video `status` to `live` (or `failed`) and records the media/poster keys.

### Metadata — DynamoDB (single table)
| Item   | PK                  | SK              | Attributes                                                  |
|--------|---------------------|-----------------|------------------------------------------------------------|
| Event  | `EVENT#<eventId>`   | `META`          | name, code, themes[], createdAt                            |
| Video  | `EVENT#<eventId>`   | `VIDEO#<id>`    | title, theme, author, status, durationSec, likes, keys, ts |

`GET /events/{id}/videos` is a single partition query (`PK = EVENT#<id>`, `SK`
begins_with `VIDEO#`) — cheap and fast. Pay-per-request billing.

---

## Security model (event-ID scoping, no auth)

Like Kahoot: the QR code encodes `https://<site>/e/<eventId>`. The `eventId` is a
~16-char random base32 token (~80 bits) — not enumerable. The API only ever
returns data for a supplied `eventId`; there is no "list all events" endpoint. So:

- Randoms landing on `/` see no event content.
- You can only reach an event's wall/upload if someone shared its QR/link.
- This is **obscurity-based access control**, appropriate for a public conference
  wall where clips are meant to be shown on a screen anyway. It is **not** privacy
  for sensitive content. v2 upgrades (out of scope): a short organizer passcode for
  the big screen/moderation, signed CloudFront URLs, and the moderation queue.

---

## Realtime

v1 uses **polling**: the Wall and Big Screen refetch `GET /events/{id}/videos`
every few seconds. Simple and cheap at conference scale. A v2 upgrade path is
API Gateway WebSockets or AppSync subscriptions to push new-video events.

See `DEPLOY.md` for how to stand this up.
