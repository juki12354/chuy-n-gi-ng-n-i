const express = require("express");
const fs = require("fs");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const {
  requireAdmin,
  requireAdminRole,
  writeAdminAudit,
} = require("../middleware/admin");
const {
  cancelTranscriptionJobForUser,
  kickTranscriptionWorker,
} = require("../services/transcriptionQueue");
const {
  getTranscriptionProvider,
  getTranscriptionProviderChain,
  isTranscriptionProviderConfigured,
  resolveStoredAudioPath,
} = require("../services/transcriptionService");
const {
  getProviderCircuitStates,
} = require("../services/providerCircuitBreaker");
const { getQuotaStatus } = require("../services/quotaService");
const { syncQuotaAlertState } = require("../services/quotaAlertService");

const router = express.Router();
const USER_ROLES = new Set(["user", "support", "finance", "admin", "super_admin"]);
const USER_STATUSES = new Set(["active", "blocked"]);
const PLANS = new Set(["free", "standard", "special", "business"]);
const JOB_STATUSES = new Set(["queued", "processing", "completed", "failed", "cancelled"]);
const ORDER_STATUSES = new Set(["pending", "paid", "cancelled", "expired", "failed"]);

router.use(requireAuth, requireAdmin);

function positiveInt(value, fallback, maximum = 100) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function parseId(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value, maximum = 500) {
  return String(value || "").trim().slice(0, maximum);
}

function hasConfiguredSecret(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && !normalized.includes("your_") && !normalized.includes("_here");
}

async function providerStatus() {
  const active = getTranscriptionProvider();
  const chain = getTranscriptionProviderChain();
  const circuitRows = await getProviderCircuitStates();
  const circuits = new Map(circuitRows.map((row) => [row.provider, row]));
  return [
    {
      code: "vbee",
      name: "Vbee Batch STT",
      configured: isTranscriptionProviderConfigured("vbee"),
      active: active === "vbee",
    },
    { code: "assemblyai", name: "AssemblyAI", configured: hasConfiguredSecret(process.env.ASSEMBLYAI_API_KEY), active: active === "assemblyai" },
    { code: "deepgram", name: "Deepgram", configured: hasConfiguredSecret(process.env.DEEPGRAM_API_KEY), active: active === "deepgram" },
    { code: "sonix", name: "Sonix", configured: hasConfiguredSecret(process.env.SONIX_API_KEY), active: active === "sonix" },
  ].map((provider) => {
    const circuit = circuits.get(provider.code);
    const priorityIndex = chain.indexOf(provider.code);
    return {
      ...provider,
      inFallbackChain: priorityIndex >= 0,
      priority: priorityIndex >= 0 ? priorityIndex + 1 : null,
      circuitState: circuit?.state || "closed",
      openUntil: circuit?.open_until || null,
      consecutiveFailures: Number(circuit?.consecutive_failures || 0),
      lastErrorCode: circuit?.last_error_code || null,
      lastFailureAt: circuit?.last_failure_at || null,
      lastSuccessAt: circuit?.last_success_at || null,
    };
  });
}

router.get("/summary", async (req, res) => {
  try {
    const [users, jobs, billing, usage, support, quotaAlerts] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::integer AS total,
                COUNT(*) FILTER (WHERE account_status = 'active')::integer AS active,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::integer AS new_30d,
                COUNT(*) FILTER (WHERE plan <> 'free')::integer AS paid_plan
         FROM users`,
      ),
      pool.query(
        `SELECT COUNT(*)::integer AS total,
                COUNT(*) FILTER (WHERE status = 'queued')::integer AS queued,
                COUNT(*) FILTER (WHERE status = 'processing')::integer AS processing,
                COUNT(*) FILTER (WHERE status = 'failed')::integer AS failed,
                COUNT(*) FILTER (WHERE status = 'completed')::integer AS completed
         FROM transcription_jobs`,
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::bigint AS revenue,
                COUNT(*) FILTER (WHERE status = 'paid')::integer AS paid_orders,
                COUNT(*) FILTER (
                  WHERE status = 'pending'
                    AND (expires_at IS NULL OR expires_at + INTERVAL '5 minutes' >= NOW())
                )::integer AS pending_orders
         FROM billing_orders`,
      ),
      pool.query(
        `SELECT COALESCE(SUM(duration), 0)::float AS processed_seconds,
                COUNT(*) FILTER (WHERE status = 'completed')::integer AS completed_transcripts
         FROM transcriptions`,
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status IN ('open', 'pending'))::integer AS open_tickets
         FROM support_tickets`,
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status IN ('open', 'acknowledged'))::integer AS active,
                COUNT(*) FILTER (WHERE status = 'open')::integer AS unread,
                COUNT(*) FILTER (
                  WHERE status IN ('open', 'acknowledged') AND level = 'exhausted'
                )::integer AS exhausted
         FROM quota_admin_alerts`,
      ),
    ]);
    const canViewBilling = ["finance", "admin", "super_admin"].includes(req.user.role);
    const canViewOperations = ["support", "admin", "super_admin"].includes(req.user.role);
    return res.json({
      users: users.rows[0],
      jobs: canViewOperations ? jobs.rows[0] : null,
      billing: canViewBilling ? billing.rows[0] : null,
      usage: canViewOperations ? usage.rows[0] : null,
      support: canViewOperations ? support.rows[0] : null,
      quotaAlerts: quotaAlerts.rows[0],
      providers: canViewOperations ? await providerStatus() : [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin summary error:", error.message);
    return res.status(500).json({ error: "Không tải được tổng quan CMS" });
  }
});

router.get("/users", requireAdminRole("admin", "super_admin"), async (req, res) => {
  const page = positiveInt(req.query.page, 1, 100000);
  const limit = positiveInt(req.query.limit, 25, 100);
  const search = cleanText(req.query.search, 200).toLowerCase();
  const plan = PLANS.has(String(req.query.plan || "")) ? String(req.query.plan) : "";
  const status = USER_STATUSES.has(String(req.query.status || "")) ? String(req.query.status) : "";
  const role = USER_ROLES.has(String(req.query.role || "")) ? String(req.query.role) : "";
  const conditions = [];
  const values = [];
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(LOWER(account.email) LIKE $${values.length} OR LOWER(CONCAT(account.first_name, ' ', account.last_name)) LIKE $${values.length})`);
  }
  if (plan) {
    values.push(plan);
    conditions.push(`account.plan = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`account.account_status = $${values.length}`);
  }
  if (role) {
    values.push(role);
    conditions.push(`account.role = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::integer AS total FROM users account ${where}`,
      values,
    );
    const rowValues = [...values, limit, (page - 1) * limit];
    const { rows } = await pool.query(
      `SELECT account.id, account.first_name, account.last_name, account.email,
              account.avatar, account.plan, account.quota_seconds,
              account.quota_alert_seconds, account.plan_started_at,
              account.plan_expires_at, account.role, account.account_status,
              account.admin_note, account.created_at,
              COALESCE(usage.used_seconds, 0)::float AS used_seconds,
              COALESCE(credits.remaining_seconds, 0)::float AS top_up_remaining_seconds,
              COALESCE(transcripts.total, 0)::integer AS transcription_count
       FROM users account
       LEFT JOIN LATERAL (
         SELECT SUM(seconds)::float AS used_seconds
         FROM quota_usage_ledger
         WHERE user_id = account.id AND period_started_at = account.plan_started_at
       ) usage ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(remaining_seconds)::float AS remaining_seconds
         FROM top_up_credits
         WHERE user_id = account.id AND remaining_seconds > 0
           AND (expires_at IS NULL OR expires_at > NOW())
       ) credits ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::integer AS total FROM transcriptions WHERE user_id = account.id
       ) transcripts ON TRUE
       ${where}
       ORDER BY account.created_at DESC
       LIMIT $${rowValues.length - 1} OFFSET $${rowValues.length}`,
      rowValues,
    );
    return res.json({
      users: rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        pages: Math.max(1, Math.ceil(countResult.rows[0].total / limit)),
      },
    });
  } catch (error) {
    console.error("Admin users error:", error.message);
    return res.status(500).json({ error: "Không tải được danh sách người dùng" });
  }
});

router.patch("/users/:id", requireAdminRole("admin", "super_admin"), async (req, res) => {
  const userId = parseId(req.params.id);
  if (!userId) return res.status(400).json({ error: "ID người dùng không hợp lệ" });
  const reason = cleanText(req.body.reason, 500);
  if (reason.length < 3) return res.status(400).json({ error: "Vui lòng nhập lý do thay đổi" });

  const requested = {};
  if (req.body.plan !== undefined) {
    if (!PLANS.has(String(req.body.plan))) return res.status(400).json({ error: "Gói cước không hợp lệ" });
    requested.plan = String(req.body.plan);
  }
  if (req.body.quotaSeconds !== undefined) {
    const value = Number(req.body.quotaSeconds);
    if (!Number.isSafeInteger(value) || value < 0 || value > 100000000) {
      return res.status(400).json({ error: "Quota không hợp lệ" });
    }
    requested.quota_seconds = value;
  }
  if (req.body.quotaAlertSeconds !== undefined) {
    const value = Number(req.body.quotaAlertSeconds);
    if (!Number.isSafeInteger(value) || value < 1 || value > 86400) {
      return res.status(400).json({ error: "Mức cảnh báo không hợp lệ" });
    }
    requested.quota_alert_seconds = value;
  }
  if (req.body.accountStatus !== undefined) {
    if (!USER_STATUSES.has(String(req.body.accountStatus))) return res.status(400).json({ error: "Trạng thái tài khoản không hợp lệ" });
    if (userId === req.user.id && req.body.accountStatus === "blocked") {
      return res.status(400).json({ error: "Bạn không thể tự khóa tài khoản đang sử dụng" });
    }
    requested.account_status = String(req.body.accountStatus);
  }
  if (req.body.adminNote !== undefined) requested.admin_note = cleanText(req.body.adminNote, 2000) || null;
  if (req.body.role !== undefined) {
    if (req.user.role !== "super_admin") return res.status(403).json({ error: "Chỉ Super Admin được thay đổi vai trò" });
    if (!USER_ROLES.has(String(req.body.role))) return res.status(400).json({ error: "Vai trò không hợp lệ" });
    if (userId === req.user.id && req.body.role !== "super_admin") {
      return res.status(400).json({ error: "Super Admin không thể tự hạ quyền" });
    }
    requested.role = String(req.body.role);
  }
  if (Object.keys(requested).length === 0) return res.status(400).json({ error: "Không có dữ liệu cần cập nhật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const beforeResult = await client.query(
      `SELECT id, email, plan, quota_seconds, quota_alert_seconds, role,
              account_status, admin_note, auth_version
       FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    const before = beforeResult.rows[0];
    if (!before) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    if (before.role === "super_admin" && req.user.role !== "super_admin") {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Bạn không thể chỉnh sửa Super Admin" });
    }

    const entries = Object.entries(requested);
    const setClauses = entries.map(([key], index) => `${key} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    if (requested.role !== undefined || requested.account_status !== undefined) {
      setClauses.push("auth_version = auth_version + 1");
    }
    values.push(userId);
    const updated = await client.query(
      `UPDATE users SET ${setClauses.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, first_name, last_name, email, plan, quota_seconds,
         quota_alert_seconds, role, account_status, admin_note, plan_expires_at,
         created_at`,
      values,
    );
    if (requested.account_status === "blocked") {
      await client.query(
        `UPDATE api_keys
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      await client.query(
        `WITH cancelled AS (
           UPDATE transcription_jobs
           SET status = 'cancelled', cancel_requested = TRUE, progress = 0,
               locked_at = NULL, lock_token = NULL, completed_at = NOW(),
               updated_at = NOW(), error_message = 'Tài khoản đã bị khóa'
           WHERE user_id = $1 AND status = 'queued'
           RETURNING transcription_id
         )
         UPDATE transcriptions
         SET status = 'cancelled', error_message = 'Tài khoản đã bị khóa'
         WHERE id IN (SELECT transcription_id FROM cancelled)`,
        [userId],
      );
      await client.query(
        `UPDATE transcription_jobs
         SET cancel_requested = TRUE, updated_at = NOW()
         WHERE user_id = $1 AND status = 'processing'`,
        [userId],
      );
    }
    if (requested.plan !== undefined || requested.quota_seconds !== undefined) {
      const quota = await getQuotaStatus(userId, { db: client });
      await syncQuotaAlertState({
        userId,
        quota,
        source: "admin_adjustment",
        db: client,
      });
    }
    await writeAdminAudit({
      req,
      action: "user.update",
      targetType: "user",
      targetId: userId,
      reason,
      before,
      after: updated.rows[0],
      db: client,
    });
    await client.query("COMMIT");
    return res.json({ user: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Admin user update error:", error.message);
    return res.status(500).json({ error: "Không cập nhật được người dùng" });
  } finally {
    client.release();
  }
});

router.get("/orders", requireAdminRole("finance", "admin", "super_admin"), async (req, res) => {
  const status = ORDER_STATUSES.has(String(req.query.status || "")) ? String(req.query.status) : "";
  const search = cleanText(req.query.search, 200).toLowerCase();
  const values = [];
  const conditions = [];
  if (status) {
    values.push(status);
    conditions.push(`orders.status = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(LOWER(account.email) LIKE $${values.length} OR LOWER(orders.id) LIKE $${values.length} OR LOWER(COALESCE(orders.payment_code, '')) LIKE $${values.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(100);
  try {
    const { rows } = await pool.query(
      `SELECT orders.id, orders.product_type, orders.product_code, orders.plan,
              orders.billing_cycle, orders.amount, orders.currency, orders.status,
              orders.provider, orders.payment_code, orders.created_at, orders.paid_at,
              account.id AS user_id, account.email,
              CONCAT(account.first_name, ' ', account.last_name) AS user_name
       FROM billing_orders orders
       JOIN users account ON account.id = orders.user_id
       ${where}
       ORDER BY orders.created_at DESC LIMIT $${values.length}`,
      values,
    );
    return res.json({ orders: rows });
  } catch (error) {
    console.error("Admin orders error:", error.message);
    return res.status(500).json({ error: "Không tải được đơn thanh toán" });
  }
});

router.get("/jobs", requireAdminRole("support", "admin", "super_admin"), async (req, res) => {
  const status = JOB_STATUSES.has(String(req.query.status || "")) ? String(req.query.status) : "";
  const search = cleanText(req.query.search, 200).toLowerCase();
  const values = [];
  const conditions = [];
  if (status) {
    values.push(status);
    conditions.push(`job.status = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(LOWER(account.email) LIKE $${values.length} OR LOWER(transcript.filename) LIKE $${values.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(100);
  try {
    const { rows } = await pool.query(
      `SELECT job.id, job.status, job.progress, job.source, job.language,
              job.audio_mode, job.translate_to, job.speaker_labels,
              job.expected_duration_seconds, job.attempts, job.max_attempts,
              job.cancel_requested, job.error_message, job.started_at,
              job.completed_at, job.created_at, job.updated_at,
              transcript.id AS transcription_id, transcript.filename,
              account.id AS user_id, account.email, account.plan
       FROM transcription_jobs job
       JOIN transcriptions transcript ON transcript.id = job.transcription_id
       JOIN users account ON account.id = job.user_id
       ${where}
       ORDER BY CASE job.status WHEN 'processing' THEN 0 WHEN 'queued' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
                job.created_at DESC
       LIMIT $${values.length}`,
      values,
    );
    return res.json({ jobs: rows });
  } catch (error) {
    console.error("Admin jobs error:", error.message);
    return res.status(500).json({ error: "Không tải được job xử lý" });
  }
});

router.post("/jobs/:id/retry", requireAdminRole("support", "admin", "super_admin"), async (req, res) => {
  const jobId = parseId(req.params.id);
  const reason = cleanText(req.body.reason, 500);
  if (!jobId || reason.length < 3) return res.status(400).json({ error: "Job hoặc lý do không hợp lệ" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT job.*, transcript.status AS transcription_status,
              transcript.audio_filename AS transcription_audio_filename
       FROM transcription_jobs job
       JOIN transcriptions transcript ON transcript.id = job.transcription_id
       WHERE job.id = $1 FOR UPDATE OF job, transcript`,
      [jobId],
    );
    const current = currentResult.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Không tìm thấy job" });
    }
    if (!new Set(["failed", "cancelled"]).has(current.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Chỉ có thể chạy lại job lỗi hoặc đã hủy" });
    }
    if (!current.transcription_audio_filename) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error:
          "File nguồn của job không còn trên máy chủ. Người dùng cần tải file lên lại.",
      });
    }
    if (
      !fs.existsSync(resolveStoredAudioPath(current.transcription_audio_filename))
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error:
          "File nguồn của job đã bị xóa khỏi ổ đĩa. Người dùng cần tải file lên lại.",
      });
    }
    const updated = await client.query(
      `UPDATE transcription_jobs
       SET status = 'queued', progress = 0, attempts = 0,
           cancel_requested = FALSE, error_message = NULL,
           available_at = NOW(), locked_at = NULL, lock_token = NULL, started_at = NULL,
           completed_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [jobId],
    );
    await client.query(
      `UPDATE transcriptions SET status = 'queued', error_message = NULL
       WHERE id = $1`,
      [current.transcription_id],
    );
    await writeAdminAudit({ req, action: "job.retry", targetType: "job", targetId: jobId, reason, before: current, after: updated.rows[0], db: client });
    await client.query("COMMIT");
    void kickTranscriptionWorker();
    return res.json({ job: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Admin job retry error:", error.message);
    return res.status(500).json({ error: "Không thể chạy lại job" });
  } finally {
    client.release();
  }
});

router.post("/jobs/:id/cancel", requireAdminRole("support", "admin", "super_admin"), async (req, res) => {
  const jobId = parseId(req.params.id);
  const reason = cleanText(req.body.reason, 500);
  if (!jobId || reason.length < 3) return res.status(400).json({ error: "Job hoặc lý do không hợp lệ" });
  try {
    const current = await pool.query("SELECT * FROM transcription_jobs WHERE id = $1", [jobId]);
    if (!current.rows[0]) return res.status(404).json({ error: "Không tìm thấy job" });
    const job = await cancelTranscriptionJobForUser(jobId, current.rows[0].user_id);
    await writeAdminAudit({ req, action: "job.cancel", targetType: "job", targetId: jobId, reason, before: current.rows[0], after: job });
    return res.json({ job });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Không thể hủy job" });
  }
});

router.get(
  "/quota-alerts",
  requireAdminRole("support", "finance", "admin", "super_admin"),
  async (req, res) => {
    const status = ["active", "unread", "resolved", "all"].includes(
      String(req.query.status || ""),
    )
      ? String(req.query.status)
      : "active";
    const search = cleanText(req.query.search, 200).toLowerCase();
    const values = [];
    const conditions = [];

    if (status === "active") conditions.push("alert.status IN ('open', 'acknowledged')");
    if (status === "unread") conditions.push("alert.status = 'open'");
    if (status === "resolved") conditions.push("alert.status = 'resolved'");
    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(LOWER(account.email) LIKE $${values.length}
          OR LOWER(CONCAT(account.first_name, ' ', account.last_name)) LIKE $${values.length})`,
      );
    }

    try {
      const { rows } = await pool.query(
        `SELECT alert.id, alert.user_id, alert.plan, alert.level, alert.status,
                alert.quota_seconds, alert.used_seconds, alert.remaining_seconds,
                alert.percent_remaining, alert.threshold_percent, alert.source,
                alert.email_status, alert.email_attempts, alert.email_sent_at,
                alert.acknowledged_at, alert.resolved_at, alert.resolution_note,
                alert.created_at, alert.updated_at,
                account.email,
                CONCAT(account.first_name, ' ', account.last_name) AS user_name
         FROM quota_admin_alerts alert
         JOIN users account ON account.id = alert.user_id
         ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         ORDER BY
           CASE alert.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
           CASE alert.level WHEN 'exhausted' THEN 3 WHEN 'critical' THEN 2 ELSE 1 END DESC,
           alert.created_at DESC
         LIMIT 200`,
        values,
      );
      return res.json({ alerts: rows });
    } catch (error) {
      console.error("Admin quota alerts error:", error.message);
      return res.status(500).json({ error: "Không tải được cảnh báo quota" });
    }
  },
);

router.patch(
  "/quota-alerts/:id/acknowledge",
  requireAdminRole("support", "finance", "admin", "super_admin"),
  async (req, res) => {
    const alertId = parseId(req.params.id);
    if (!alertId) return res.status(400).json({ error: "Cảnh báo không hợp lệ" });
    try {
      const before = await pool.query(
        "SELECT * FROM quota_admin_alerts WHERE id = $1",
        [alertId],
      );
      if (!before.rows[0]) return res.status(404).json({ error: "Không tìm thấy cảnh báo" });
      const updated = await pool.query(
        `UPDATE quota_admin_alerts
         SET status = CASE WHEN status = 'open' THEN 'acknowledged' ELSE status END,
             acknowledged_at = COALESCE(acknowledged_at, NOW()),
             acknowledged_by = COALESCE(acknowledged_by, $2),
             updated_at = NOW()
         WHERE id = $1 AND status IN ('open', 'acknowledged')
         RETURNING *`,
        [alertId, req.user.id],
      );
      const alert = updated.rows[0] || before.rows[0];
      await writeAdminAudit({
        req,
        action: "quota_alert.acknowledge",
        targetType: "quota_alert",
        targetId: alertId,
        reason: "Đã xem cảnh báo quota",
        before: before.rows[0],
        after: alert,
      });
      return res.json({ alert });
    } catch (error) {
      console.error("Acknowledge quota alert error:", error.message);
      return res.status(500).json({ error: "Không xác nhận được cảnh báo" });
    }
  },
);

router.patch(
  "/quota-alerts/:id/resolve",
  requireAdminRole("support", "finance", "admin", "super_admin"),
  async (req, res) => {
    const alertId = parseId(req.params.id);
    const reason = cleanText(req.body.reason, 500);
    if (!alertId) return res.status(400).json({ error: "Cảnh báo không hợp lệ" });
    if (reason.length < 3) return res.status(400).json({ error: "Vui lòng nhập cách xử lý" });
    try {
      const before = await pool.query(
        "SELECT * FROM quota_admin_alerts WHERE id = $1",
        [alertId],
      );
      if (!before.rows[0]) return res.status(404).json({ error: "Không tìm thấy cảnh báo" });
      const updated = await pool.query(
        `UPDATE quota_admin_alerts
         SET status = 'resolved', resolved_at = COALESCE(resolved_at, NOW()),
             resolved_by = COALESCE(resolved_by, $2), resolution_note = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [alertId, req.user.id, reason],
      );
      await writeAdminAudit({
        req,
        action: "quota_alert.resolve",
        targetType: "quota_alert",
        targetId: alertId,
        reason,
        before: before.rows[0],
        after: updated.rows[0],
      });
      return res.json({ alert: updated.rows[0] });
    } catch (error) {
      console.error("Resolve quota alert error:", error.message);
      return res.status(500).json({ error: "Không xử lý được cảnh báo" });
    }
  },
);

router.get("/support", requireAdminRole("support", "admin", "super_admin"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ticket.id, ticket.subject, ticket.category, ticket.priority,
              ticket.status, ticket.email, ticket.name, ticket.user_plan,
              ticket.created_at, ticket.updated_at,
              COUNT(message.id)::integer AS message_count
       FROM support_tickets ticket
       LEFT JOIN support_messages message ON message.ticket_id = ticket.id
       GROUP BY ticket.id
       ORDER BY CASE ticket.status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                ticket.updated_at DESC LIMIT 100`,
    );
    return res.json({ tickets: rows });
  } catch (error) {
    return res.status(500).json({ error: "Không tải được yêu cầu hỗ trợ" });
  }
});

router.patch("/support/:id", requireAdminRole("support", "admin", "super_admin"), async (req, res) => {
  const ticketId = parseId(req.params.id);
  const status = String(req.body.status || "");
  const reason = cleanText(req.body.reason, 500);
  if (!ticketId || !new Set(["open", "pending", "resolved", "closed"]).has(status) || reason.length < 3) {
    return res.status(400).json({ error: "Trạng thái hoặc lý do không hợp lệ" });
  }
  try {
    const before = await pool.query("SELECT * FROM support_tickets WHERE id = $1", [ticketId]);
    if (!before.rows[0]) return res.status(404).json({ error: "Không tìm thấy yêu cầu hỗ trợ" });
    const updated = await pool.query(
      `UPDATE support_tickets
       SET status = $1, updated_at = NOW(),
           resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
       WHERE id = $2 RETURNING *`,
      [status, ticketId],
    );
    await writeAdminAudit({ req, action: "support.status", targetType: "support_ticket", targetId: ticketId, reason, before: before.rows[0], after: updated.rows[0] });
    return res.json({ ticket: updated.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Không cập nhật được yêu cầu hỗ trợ" });
  }
});

router.get("/audit", requireAdminRole("admin", "super_admin"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT audit.id, audit.action, audit.target_type, audit.target_id,
              audit.reason, audit.before_data, audit.after_data,
              audit.request_id, audit.created_at,
              actor.email AS actor_email,
              CONCAT(actor.first_name, ' ', actor.last_name) AS actor_name
       FROM admin_audit_logs audit
       LEFT JOIN users actor ON actor.id = audit.actor_user_id
       ORDER BY audit.created_at DESC LIMIT 200`,
    );
    return res.json({ logs: rows });
  } catch (error) {
    return res.status(500).json({ error: "Không tải được nhật ký quản trị" });
  }
});

module.exports = router;
