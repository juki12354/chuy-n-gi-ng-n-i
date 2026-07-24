import { adminRequest } from "./api-client";
import type { DashboardSummary } from "./types";

export function fetchDashboardSummary() {
  return adminRequest<DashboardSummary>("/api/admin/dashboard");
}
