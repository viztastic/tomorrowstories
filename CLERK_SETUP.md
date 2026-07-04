# Enabling organizer sign-in (Clerk)

Phase 2 adds organizer accounts. **Participants are unaffected** — they still join
a wall with just the QR / link / event code, no sign-in. Only people who **create
or manage** events sign in.

Until you complete these steps the app runs in **open mode** (anyone can create/
manage events, exactly like Phase 1). Once Clerk keys are set, `POST /events` and
the dashboard require sign-in, and each organizer only sees/manages their own
events. The legacy admin password is retired.

Only organizers authenticate, so you'll stay comfortably inside Clerk's free tier.

---

## 1. Create a Clerk application

1. Sign up at <https://dashboard.clerk.com> and **create an application**.
2. Under **User & Authentication → Email, Phone, Username**:
   - Enable **Email address**.
   - Set the email verification method to **Email verification code** (the 6-digit
     OTP). You can turn *off* password if you want passwordless-only.
3. Under **User & Authentication → Social Connections**, enable:
   - **Google** — works out of the box with Clerk's shared dev credentials; for
     production add your own Google OAuth client (Clerk shows the exact redirect
     URI to paste into Google Cloud Console).
   - **Microsoft** — same: dev works immediately; for production register an app in
     Entra ID / Azure AD and paste Clerk's redirect URI.
   (Instagram was intentionally dropped — no standard OIDC and often no email.)

## 2. Tell Clerk your site URL

In **Paths** (or **Domains** for production):

- Set the **Sign-in URL** to `/sign-in`.
- Add your CloudFront site (e.g. `https://d3qfw14f8gdgri.cloudfront.net`) as an
  allowed origin / production domain when you go live.

## 3. Copy your API keys

From **API Keys**:

- **Publishable key** — starts with `pk_test_…` (or `pk_live_…`). Public; embedded
  in the SPA.
- **Secret key** — starts with `sk_test_…` (or `sk_live_…`). **Secret**; used only
  by the backend Lambda to verify sessions. Never commit it.

## 4. Deploy with the keys

From the project root:

```bash
export CLERK_PUBLISHABLE_KEY="pk_test_xxx"
export CLERK_SECRET_KEY="sk_test_xxx"
# optional: comma-separated Clerk user ids that can see ALL events at /admin
# export SUPER_ADMIN_IDS="user_abc123"
./deploy.sh
```

`deploy.sh` saves these to a gitignored `./.clerk-env` and reuses them on future
runs (sticky, like the transcode mode), so you only pass them once. The deploy
summary will show `Organizer auth: ON`.

## 5. Find your super-admin user id (optional)

After you sign in once at `/sign-in`, open the Clerk dashboard → **Users**, click
your user, and copy the **User ID** (`user_…`). Put it in `SUPER_ADMIN_IDS` and
re-deploy to let that account view every event at `/admin` (regular organizers
only see their own).

---

## What changes when auth is on

| Route | Before (open) | With Clerk |
|---|---|---|
| Join / watch / upload (`/e/:id`, `/e/:id/big`) | public | **public (unchanged)** |
| `POST /events` (create) | anyone | **signed-in organizer**, becomes the owner |
| `/admin` dashboard | shared password | **signed-in**, lists *your* events |
| Edit / delete an event | shared password | **owner or super-admin only** |

Plan tiers (`free` / `paid` / `unlimited`) are scaffolded: every organizer starts
on `free`, and quota checks live in the API (`backend/src/shared/plans.ts`).
Billing (Stripe / Clerk Billing) is a later phase — no payment is wired yet.

## Troubleshooting

- **Sign-in page looks blank / redirect loop:** confirm the **Sign-in URL** in
  Clerk is `/sign-in` and the publishable key in `/config.json` matches your app.
- **401 on create/manage after signing in:** the backend Lambda needs
  `CLERK_SECRET_KEY`; re-run `./deploy.sh` after exporting it.
- **Want to go back to open mode:** delete `./.clerk-env` (and unset the env vars)
  and re-deploy.
