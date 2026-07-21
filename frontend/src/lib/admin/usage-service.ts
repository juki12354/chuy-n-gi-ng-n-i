import { adminRequest } from "./api-client";
import type { UsageSummary } from "./types";

export function fetchUsageSummary() {
  return adminRequest<UsageSummary>("/api/admin/usage");
}
