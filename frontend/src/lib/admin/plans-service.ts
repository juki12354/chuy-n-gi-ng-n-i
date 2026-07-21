import { adminRequest } from "./api-client";
import type { ServicePlan } from "./types";

export function listServicePlans() {
  return adminRequest<ServicePlan[]>("/api/admin/plans");
}

export function saveServicePlan(plan: ServicePlan) {
  return adminRequest<ServicePlan>(`/api/admin/plans/${plan.id}`, {
    method: "PUT",
    body: JSON.stringify(plan),
  });
}
