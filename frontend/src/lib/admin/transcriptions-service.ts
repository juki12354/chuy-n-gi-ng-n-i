import { adminRequest, buildQuery } from "./api-client";
import type {
  ListJobsParams,
  PaginatedResponse,
  TranscriptionJob,
} from "./types";

export function listTranscriptionJobs(params: ListJobsParams) {
  return adminRequest<PaginatedResponse<TranscriptionJob>>(
    `/api/admin/jobs${buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      status: params.status,
      language: params.language,
    })}`,
  );
}

export function retryTranscriptionJob(jobId: string) {
  return adminRequest<TranscriptionJob>(`/api/admin/jobs/${jobId}/retry`, {
    method: "POST",
  });
}

export function cancelTranscriptionJob(jobId: string) {
  return adminRequest<TranscriptionJob>(`/api/admin/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}
