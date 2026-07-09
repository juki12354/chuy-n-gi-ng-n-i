import type { BillingCycle, PlanCode, QuotaStatus } from "@/lib/quota";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "expired";
export type PaidPlanCode = Exclude<PlanCode, "free" | "business">;

export interface BillingOrder {
  id: string;
  userId: number;
  plan: PaidPlanCode;
  label: string;
  billingCycle: BillingCycle;
  quotaSeconds: number;
  amount: number;
  currency: string;
  status: OrderStatus;
  provider: string;
  providerOrderId?: string | null;
  paymentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  expiresAt?: string | null;
}

export interface CheckoutResponse {
  order: BillingOrder;
  paymentUrl: string;
}

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Yêu cầu không thành công");
  return data;
}

export async function createCheckout(
  token: string,
  plan: PaidPlanCode,
  billingCycle: BillingCycle,
): Promise<CheckoutResponse> {
  const res = await fetch(`${API_URL}/api/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan, billingCycle, provider: "demo" }),
  });
  return readJson<CheckoutResponse>(res);
}

export async function fetchBillingOrder(
  token: string,
  orderId: string,
): Promise<BillingOrder> {
  const res = await fetch(`${API_URL}/api/billing/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await readJson<{ order: BillingOrder }>(res);
  return data.order;
}

export async function confirmDemoPayment(
  token: string,
  orderId: string,
): Promise<{ order: BillingOrder; quota: QuotaStatus }> {
  const res = await fetch(`${API_URL}/api/billing/demo/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });
  return readJson<{ order: BillingOrder; quota: QuotaStatus }>(res);
}
