// Plan-tier foundation. Limits are keyed by plan; only the plan id + usage
// counters live on the OrganizerItem. Billing (Stripe/Clerk Billing) is a later
// phase — for now every organizer is created on the free tier. Quota checks in
// api.ts read these limits; bump them or add tiers here without a schema change.

export type Plan = "free" | "paid" | "unlimited";

export interface PlanLimits {
  maxEvents: number; // how many events an organizer may own at once
  maxClipsPerEvent: number; // how many clips attendees may post to one event
  canDownloadArchive: boolean; // gate on the admin zip export
  canCustomizePalette: boolean; // gate on non-default visual palettes
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxEvents: 3, maxClipsPerEvent: 200, canDownloadArchive: true, canCustomizePalette: true },
  paid: { maxEvents: 25, maxClipsPerEvent: 2000, canDownloadArchive: true, canCustomizePalette: true },
  unlimited: { maxEvents: Infinity, maxClipsPerEvent: Infinity, canDownloadArchive: true, canCustomizePalette: true },
};

export const DEFAULT_PLAN: Plan = "free";

export function limitsFor(plan: Plan | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? DEFAULT_PLAN] ?? PLAN_LIMITS[DEFAULT_PLAN];
}
