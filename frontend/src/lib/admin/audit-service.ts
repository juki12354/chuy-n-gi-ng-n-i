import { adminRequest, buildQuery } from "./api-client";
import type { AuditLog, ListAuditLogsParams, PaginatedResponse } from "./types";

export function listAuditLogs(params: ListAuditLogsParams) {
  return adminRequest<PaginatedResponse<AuditLog>>(
    `/api/admin/audit-logs${buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      action: params.action,
      actor: params.actor,
    })}`,
  );
}
