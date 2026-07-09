import type { BillingCycle, PlanCode } from "@/lib/quota";

const PENDING_PLAN_PURCHASE_KEY = "pending_plan_purchase";
const MAX_PENDING_AGE_MS = 30 * 60 * 1000;

export type PurchasablePlanCode = Exclude<PlanCode, "free" | "business">;

export interface PendingPlanPurchase {
  plan: PurchasablePlanCode;
  billingCycle: BillingCycle;
  planName: string;
  requestedAt: number;
}

function isPurchasablePlan(plan: unknown): plan is PurchasablePlanCode {
  return plan === "standard" || plan === "special";
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "yearly";
}

export function savePendingPlanPurchase(
  plan: PurchasablePlanCode,
  billingCycle: BillingCycle,
  planName: string,
) {
  if (typeof window === "undefined") return;
  const payload: PendingPlanPurchase = {
    plan,
    billingCycle,
    planName,
    requestedAt: Date.now(),
  };
  sessionStorage.setItem(PENDING_PLAN_PURCHASE_KEY, JSON.stringify(payload));
}

export function getPendingPlanPurchase(): PendingPlanPurchase | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(PENDING_PLAN_PURCHASE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingPlanPurchase>;
    const isExpired =
      !parsed.requestedAt || Date.now() - parsed.requestedAt > MAX_PENDING_AGE_MS;

    if (
      isExpired ||
      !isPurchasablePlan(parsed.plan) ||
      !isBillingCycle(parsed.billingCycle)
    ) {
      clearPendingPlanPurchase();
      return null;
    }

    return {
      plan: parsed.plan,
      billingCycle: parsed.billingCycle,
      planName: parsed.planName || parsed.plan,
      requestedAt: parsed.requestedAt,
    };
  } catch {
    clearPendingPlanPurchase();
    return null;
  }
}

export function clearPendingPlanPurchase() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_PLAN_PURCHASE_KEY);
}
