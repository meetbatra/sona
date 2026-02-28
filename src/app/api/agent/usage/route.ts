import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { convex } from "@/lib/convex-client";
import { api } from "../../../../../convex/_generated/api";
import { getUserPlan, PLAN_LIMITS } from "@/lib/billing";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalKey = process.env.SONA_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Internal key not configured" },
      { status: 500 },
    );
  }

  const plan = await getUserPlan();
  const limit = PLAN_LIMITS[plan];

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const usage = await convex.query(api.system.getAgentRunCountForMonth, {
    internalKey,
    userId,
    year,
    month,
  });

  return NextResponse.json({
    plan,
    used: usage.count,
    limit,
  });
}
