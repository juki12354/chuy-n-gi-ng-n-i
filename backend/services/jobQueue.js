const crypto = require("crypto");

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETENTION_MS = 60 * 60 * 1000;

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

class JobQueue {
  constructor({
    concurrency = DEFAULT_CONCURRENCY,
    maxRetries = DEFAULT_MAX_RETRIES,
    retentionMs = DEFAULT_RETENTION_MS,
  } = {}) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
    this.retentionMs = retentionMs;
    this.jobs = new Map();
    this.pending = [];
    this.activeCount = 0;
  }

  add({ type, userId, data, handler }) {
    if (typeof handler !== "function") {
      throw new Error("Job handler is required");
    }

    const now = new Date().toISOString();
    let resolveJob;
    let rejectJob;
    const promise = new Promise((resolve, reject) => {
      resolveJob = resolve;
      rejectJob = reject;
    });
    promise.catch(() => {});

    const job = {
      id: crypto.randomUUID(),
      type,
      userId,
      status: "queued",
      attempts: 0,
      maxRetries: this.maxRetries,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      error: null,
      result: null,
      data,
      handler,
      promise,
      resolveJob,
      rejectJob,
    };

    this.jobs.set(job.id, job);
    this.pending.push(job.id);
    this.cleanup();
    this.runNext();

    return this.serialize(job);
  }

  addAndWait(options) {
    const job = this.add(options);
    return this.wait(job.id);
  }

  get(jobId, userId = null) {
    const job = this.jobs.get(jobId);
    if (!job || (userId !== null && job.userId !== userId)) return null;
    return this.serialize(job);
  }

  listByUser(userId, limit = 20) {
    return Array.from(this.jobs.values())
      .filter((job) => job.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map((job) => this.serialize(job));
  }

  listAll(limit = 100) {
    return Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map((job) => this.serialize(job));
  }

  stats() {
    return {
      concurrency: this.concurrency,
      active: this.activeCount,
      queued: this.pending.length,
      total: this.jobs.size,
    };
  }

  wait(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return Promise.reject(new Error("Job not found"));
    }
    if (job.status === "completed") return Promise.resolve(job.result);
    if (job.status === "failed") {
      const error = new Error(job.error?.message || "Job failed");
      error.statusCode = job.error?.statusCode || 500;
      error.details = {
        quota: job.error?.quota,
        usageAlert: job.error?.usageAlert,
      };
      return Promise.reject(error);
    }
    return job.promise;
  }

  runNext() {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const jobId = this.pending.shift();
      const job = this.jobs.get(jobId);
      if (!job || job.status !== "queued") continue;
      this.run(job);
    }
  }

  async run(job) {
    this.activeCount += 1;
    job.status = "processing";
    job.attempts += 1;
    job.startedAt = job.startedAt || new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    try {
      job.result = await job.handler(job.data);
      job.status = "completed";
      job.error = null;
      job.finishedAt = new Date().toISOString();
      job.updatedAt = job.finishedAt;
      job.resolveJob(job.result);
    } catch (error) {
      job.error = {
        message: error.message || "Job failed",
        statusCode: error.statusCode || 500,
        quota: error.details?.quota,
        usageAlert: error.details?.usageAlert,
      };
      job.updatedAt = new Date().toISOString();

      if (job.attempts <= job.maxRetries) {
        job.status = "queued";
        this.pending.push(job.id);
      } else {
        job.status = "failed";
        job.finishedAt = job.updatedAt;
        job.rejectJob(error);
      }
    } finally {
      this.activeCount -= 1;
      this.cleanup();
      this.runNext();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [jobId, job] of this.jobs.entries()) {
      if (!["completed", "failed"].includes(job.status)) continue;
      const finishedAt = job.finishedAt
        ? new Date(job.finishedAt).getTime()
        : now;
      if (now - finishedAt > this.retentionMs) {
        this.jobs.delete(jobId);
      }
    }
  }

  serialize(job) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxRetries: job.maxRetries,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      input: job.data?.file
        ? {
            filename: job.data.file.originalname,
            fileSize: job.data.file.size,
          }
        : null,
      result: job.result,
    };
  }
}

const transcriptionQueue = new JobQueue({
  concurrency: readPositiveInt(
    process.env.TRANSCRIPTION_QUEUE_CONCURRENCY,
    DEFAULT_CONCURRENCY,
  ),
  maxRetries: readPositiveInt(
    process.env.TRANSCRIPTION_QUEUE_MAX_RETRIES,
    DEFAULT_MAX_RETRIES,
  ),
  retentionMs: readPositiveInt(
    process.env.TRANSCRIPTION_QUEUE_RETENTION_MS,
    DEFAULT_RETENTION_MS,
  ),
});

module.exports = {
  JobQueue,
  transcriptionQueue,
};
