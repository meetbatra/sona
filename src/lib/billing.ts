import { auth } from "@clerk/nextjs/server";

export type Plan = "free" | "pro";

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 5,
  pro: 15,
};

/**
 * Resolve the user's Billing plan using Clerk Billing features,
 * similar to the `sona-lovable` repo.
 *
 * Assumes you have a feature configured like: { plan: "pro" }
 * on the Pro plan in Clerk Billing.
 */
export async function getUserPlan(): Promise<Plan> {
  const { has } = await auth();

  if (typeof has === "function") {
    try {
      const hasPro = await has({ plan: "pro" });
      if (hasPro) return "pro";
    } catch (error) {
      console.warn("getUserPlan: has({ plan: 'pro' }) failed, defaulting to free", error);
    }
  }

  return "free";
}
