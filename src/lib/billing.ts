import { clerkClient } from "@clerk/nextjs/server";

export type Plan = "free" | "pro";

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 5,
  pro: 15,
};

/**
 * Resolve the user's Billing plan based on Clerk user metadata.
 *
 * This implementation expects you to keep `planSlug` in Clerk user metadata
 * (public or private) in sync with Clerk Billing via webhooks.
 *
 * If no planSlug is found or it's not recognized, the user is treated as `free`.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const user = await clerkClient.users.getUser(userId);

  const planSlug =
    (user.publicMetadata.planSlug as string | undefined) ??
    (user.privateMetadata.planSlug as string | undefined);

  if (planSlug === "pro") return "pro";

  return "free";
}
