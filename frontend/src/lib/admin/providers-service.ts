import { adminRequest } from "./api-client";
import type { SpeechProvider } from "./types";

export function listSpeechProviders() {
  return adminRequest<SpeechProvider[]>("/api/admin/providers");
}

export function saveSpeechProvider(provider: SpeechProvider) {
  return adminRequest<SpeechProvider>(`/api/admin/providers/${provider.id}`, {
    method: "PUT",
    body: JSON.stringify(provider),
  });
}

export function checkSpeechProvider(providerId: string) {
  return adminRequest<SpeechProvider>(
    `/api/admin/providers/${providerId}/health`,
    {
      method: "POST",
    },
  );
}
