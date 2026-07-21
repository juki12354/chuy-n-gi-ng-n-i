import { adminRequest } from "./api-client";
import type { ReportSummary, SystemStatus } from "./types";

export function fetchReportSummary() {
  return adminRequest<ReportSummary>("/api/admin/reports/summary");
}

export function exportReportCsv() {
  return adminRequest<{ filename: string; content: string }>(
    "/api/admin/reports/export",
  );
}

export function fetchSystemStatus() {
  return adminRequest<SystemStatus>("/api/admin/system/status");
}
