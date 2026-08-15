import type { MemberTier } from "@/lib/api";

/**
 * Tier ordering matches every price array in the app: [Agent, Silver, Gold, Diamond].
 * Agent (index 0) is the non-member / base price (highest); Diamond (index 3) is
 * the cheapest. A member always pays THEIR tagged tier — cheaper tiers are only
 * unlocked by topping up, never by choosing them at checkout.
 */
export const TIER_LABELS = ["Agent", "Silver", "Gold", "Diamond"] as const;

/** Top-up needed to REACH each tier (matches the backend membership thresholds). */
export const TIER_THRESHOLD: Record<string, number> = { Silver: 2000, Gold: 5000, Diamond: 10000 };

export function tierIndex(tier: MemberTier | null | undefined): number {
  if (tier === "Silver") return 1;
  if (tier === "Gold") return 2;
  if (tier === "Diamond") return 3;
  return 0; // no tier / guest → Agent (base) price
}

export function tierLabel(idx: number): string {
  return TIER_LABELS[idx] ?? "Agent";
}
