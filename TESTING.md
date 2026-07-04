# Testing

Three layers, runnable from the repo root.

```
npm run test:unit    # backend + frontend + export-tool unit tests (fast, no network)
npm run test:e2e     # Playwright end-to-end against the demo build
npm test             # everything
```

Current totals: **57 unit** (backend 29, frontend 24, tools 4) + **34 E2E**.

## Unit tests

**Backend** (`backend/test/`, Vitest + `aws-sdk-client-mock`):
- `ids.test.ts` — id/code format, length, uniqueness.
- `dto.test.ts` — event/video → wire-shape mapping and media URL construction.
- `api.test.ts` — every API route with mocked DynamoDB/S3: create event (+ code
  mapping), join-by-code (200/404), list videos, like, upload validation, CORS,
  unknown route, admin auth (401/200).
- `onRawUpload.test.ts` — starts a transcode job; **marks the clip failed (never
  spins forever) when the job can't start**; ignores non-upload keys.
- `onTranscodeDone.test.ts` — flips a clip to live with its media key on
  COMPLETE; failed on ERROR or a completed-but-no-MP4 job.

```
cd backend && npm test
```

**Frontend** (`frontend/src/**/*.test.*`, Vitest + Testing Library, jsdom):
- `design.test.ts` — formatting/colour helpers.
- `demo.test.ts` — the in-memory demo store (create/list/add/like/resolveCode).
- `api.test.ts` — the S3 presigned-POST form builder (no duplicate Content-Type,
  file appended last) — the fix for the upload 403.
- `components/Landing.test.tsx` — join-by-code flow, inline error placement,
  link pass-through, and mode gating (`/join` vs `/create`).

**Export tool** (`tools/*.test.mjs`, node:test): slug/escape helpers and the
offline-wall HTML generator.

```
cd frontend && npm test
```

Runs in forced demo mode (`VITE_DEMO=1`) so there's no network.

## End-to-end (Playwright)

`e2e/tests/` drives a real browser against a demo build of the app (built +
served automatically by Playwright's `webServer`). Two projects — **desktop**
(1440×900) and **mobile** (390×844) — so every spec runs at both sizes.

- `responsive.spec.ts` — asserts **zero horizontal overflow** on every route at
  both sizes (the regression that kept biting on phones).
- `landing.spec.ts` — create → big screen; join via pasted link; unknown-code
  inline error.
- `attendee.spec.ts` — wall renders seeded stories; open a story; open upload;
  theme filter.
- `bigscreen.spec.ts` — code+QR present everywhere; mobile shows the organizer
  panel; desktop shows the projector wall.

First-time setup (downloads the browser Playwright needs):
```
cd e2e && npm install && npx playwright install chromium
npm test
```

## Notes
- Unit tests are the TDD surface — add a failing test, make it pass. They're
  fast and hermetic.
- E2E is the safety net for real rendering/responsive behaviour before a demo.
- CI suggestion: `npm run test:unit` on every push; `npm run test:e2e` on PRs.
