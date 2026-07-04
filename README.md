# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/index.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Conference video showcase platform` project files (HTML prototypes, assets, components)

---

## Implementation (built from this handoff)

The design has been implemented as a real, hostable app — **Tomorrow Stories**,
v1 = attendee app + big screen, no auth, event-ID scoped (Kahoot-style).

- **`ARCHITECTURE.md`** — the AWS design, data model, and security model.
- **`DEPLOY.md`** — run the demo locally, deploy to AWS, and export the wall.
- **`TESTING.md`** — the test suites (unit + E2E) and how to run them.
- **`frontend/`** — React + Vite SPA. Genuinely responsive (real desktop layout,
  full-bleed mobile), installable PWA.
- **`backend/`** — Lambda handlers (API, transcode start, transcode complete).
- **`infra/`** — AWS CDK (TypeScript): S3 + CloudFront + API Gateway + Lambda +
  DynamoDB + MediaConvert.
- **`e2e/`** — Playwright end-to-end tests (desktop + mobile).
- **`tools/export-wall.mjs`** — post-event export: downloads all videos + builds a
  self-contained offline HTML wall.
- **`tools/diagnose.sh`** — shows why an upload might be stuck (MediaConvert jobs +
  transcode Lambda logs).

Routes: `/` (join/create), `/join`, `/create`, `/admin` (session list),
`/e/:id` (attendee), `/e/:id/big` (big screen).

Run the tests: `npm test` (56 unit + 34 E2E).

Quick look, no AWS needed:
```bash
cd frontend && npm install && VITE_DEMO=1 npm run dev
# then open /e/demo  and  /e/demo/big
```
