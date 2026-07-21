import { adminRequest } from "./api-client";
import type { AdminSettings } from "./types";

export function fetchSettings() {
  return adminRequest<AdminSettings>("/api/admin/settings");
}

export function updateSettings(settings: AdminSettings) {
  return adminRequest<AdminSettings>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
