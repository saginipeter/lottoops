import type { SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type PlanCapability = "MULTI_STORE" | "ADVANCED_REPORTS" | "LIVE_DISPLAY";

const CAPABILITY_PLANS: Record<PlanCapability, string[]> = {
  MULTI_STORE: ["COMMAND"],
  ADVANCED_REPORTS: ["CONTROL", "COMMAND"],
  LIVE_DISPLAY: ["COMMAND"],
};

interface PlanAccess {
  enforced: boolean;
  allowed: boolean;
  planKey: string | null;
}

export async function getPlanAccess(
  session: SessionPayload,
  capability: PlanCapability
): Promise<PlanAccess> {
  if (!prisma || session.role === "PLATFORM_ADMIN") {
    return { enforced: false, allowed: true, planKey: null };
  }

  const store = await prisma.store.findFirst({
    where: {
      id: session.storeId,
      OR: [
        { ownerUserId: session.userId },
        { users: { some: { id: session.userId, role: "OWNER", active: true } } },
      ],
    },
    select: { organizationId: true },
  });
  if (!store?.organizationId) {
    return { enforced: false, allowed: true, planKey: null };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: store.organizationId },
    include: { plan: { select: { key: true } } },
  });
  if (!subscription) {
    return { enforced: false, allowed: true, planKey: null };
  }

  const activeStatus = ["TRIALING", "ACTIVE"].includes(subscription.status);
  const allowed = activeStatus && CAPABILITY_PLANS[capability].includes(subscription.plan.key);
  return { enforced: true, allowed, planKey: subscription.plan.key };
}

export async function requirePlanCapability(
  session: SessionPayload,
  capability: PlanCapability
) {
  const access = await getPlanAccess(session, capability);
  return access.allowed;
}
