const pool = require("../db");
const crypto = require("crypto");

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}

function createHttpError(statusCode, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getEnvInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function getEnvString(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === null ? fallback : String(value).trim();
}

function getEnvBool(name, fallback = false) {
  const value = getEnvString(name).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function normalizeSmtpPassword(password) {
  const shouldStripSpaces = getEnvBool("SMTP_PASS_STRIP_SPACES", true);
  return shouldStripSpaces ? password.replace(/\s+/g, "") : password;
}

const PLAN_CONFIG = {
  free: {
    name: "free",
    label: "Free",
    quotaSeconds: getEnvInt("FREE_PLAN_SECONDS", 30 * 60),
    maxUploadMb: getEnvInt("FREE_MAX_UPLOAD_MB", 50),
    maxRecordSeconds: getEnvInt("FREE_MAX_RECORD_SECONDS", 10 * 60),
    maxFileSeconds: getEnvInt("FREE_MAX_FILE_SECONDS", 30 * 60),
  },
  standard: {
    name: "standard",
    label: "Tiêu chuẩn",
    quotaSeconds: getEnvInt("STANDARD_MONTHLY_SECONDS", 300 * 60),
    yearlyQuotaSeconds: getEnvInt("STANDARD_YEARLY_SECONDS", 3600 * 60),
    maxUploadMb: getEnvInt("STANDARD_MAX_UPLOAD_MB", 200),
    maxRecordSeconds: getEnvInt("STANDARD_MAX_RECORD_SECONDS", 60 * 60),
    maxFileSeconds: getEnvInt("STANDARD_MAX_FILE_SECONDS", 2 * 60 * 60),
  },
  special: {
    name: "special",
    label: "Đặc biệt",
    quotaSeconds: getEnvInt("SPECIAL_MONTHLY_SECONDS", 1200 * 60),
    yearlyQuotaSeconds: getEnvInt("SPECIAL_YEARLY_SECONDS", 14400 * 60),
    maxUploadMb: getEnvInt("SPECIAL_MAX_UPLOAD_MB", 1024),
    maxRecordSeconds: getEnvInt("SPECIAL_MAX_RECORD_SECONDS", 2 * 60 * 60),
    maxFileSeconds: getEnvInt("SPECIAL_MAX_FILE_SECONDS", 4 * 60 * 60),
  },
  business: {
    name: "business",
    label: "Business",
    quotaSeconds: getEnvInt("BUSINESS_MONTHLY_SECONDS", 10000 * 60),
    yearlyQuotaSeconds: getEnvInt("BUSINESS_YEARLY_SECONDS", 120000 * 60),
    maxUploadMb: getEnvInt("BUSINESS_MAX_UPLOAD_MB", 2048),
    maxRecordSeconds: getEnvInt("BUSINESS_MAX_RECORD_SECONDS", 8 * 60 * 60),
    maxFileSeconds: getEnvInt("BUSINESS_MAX_FILE_SECONDS", 12 * 60 * 60),
  },
};

const DEFAULT_ALERT_SECONDS = getEnvInt("DEFAULT_QUOTA_ALERT_SECONDS", 5 * 60);
const DAILY_USAGE_ALERT_SECONDS = getEnvInt(
  "DAILY_USAGE_ALERT_SECONDS",
  60 * 60,
);
const DAILY_USAGE_ALERT_EMAIL_COOLDOWN_SECONDS = getEnvInt(
  "DAILY_USAGE_ALERT_EMAIL_COOLDOWN_SECONDS",
  24 * 60 * 60,
);
const BACKEND_URL =
  process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

function normalizePlan(plan) {
  const clean = String(plan || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (["standard", "basic", "tieu_chuan", "tiêu_chuẩn"].includes(clean)) {
    return "standard";
  }
  if (
    ["special", "pro", "premium", "dac_biet", "đặc_biệt"].includes(clean)
  ) {
    return "special";
  }
  if (["business", "enterprise", "doanh_nghiep", "doanh_nghiệp"].includes(clean)) {
    return "business";
  }
  return "free";
}

function getPlanConfig(plan) {
  return PLAN_CONFIG[normalizePlan(plan)];
}

function normalizeBillingCycle(value) {
  return String(value || "").toLowerCase() === "yearly" ? "yearly" : "monthly";
}

function getPurchasedQuotaSeconds(planName, billingCycle) {
  const config = getPlanConfig(planName);
  return normalizeBillingCycle(billingCycle) === "yearly"
    ? config.yearlyQuotaSeconds || config.quotaSeconds * 12
    : config.quotaSeconds;
}

async function getUserBilling(userId) {
  const { rows } = await pool.query(
    `SELECT id, plan, quota_seconds, quota_alert_seconds, plan_started_at, plan_expires_at,
            usage_alert_daily_seconds,
            usage_alert_date = CURRENT_DATE AS is_usage_alert_today,
            usage_alert_required,
            usage_alert_confirmed_at::date = CURRENT_DATE AS is_usage_alert_confirmed_today
     FROM users WHERE id = $1`,
    [userId],
  );
  if (!rows[0]) throw createHttpError(404, "Không tìm thấy người dùng");

  const planName = normalizePlan(rows[0].plan);
  const config = getPlanConfig(planName);
  return {
    userId,
    plan: planName,
    label: config.label,
    quotaSeconds: Number(rows[0].quota_seconds || config.quotaSeconds),
    alertSeconds: Number(rows[0].quota_alert_seconds || DEFAULT_ALERT_SECONDS),
    usageAlertDailySeconds: rows[0].is_usage_alert_today
      ? Number(rows[0].usage_alert_daily_seconds || 0)
      : 0,
    usageAlertThresholdSeconds: DAILY_USAGE_ALERT_SECONDS,
    usageAlertRequired:
      Boolean(rows[0].is_usage_alert_today) &&
      Boolean(rows[0].usage_alert_required) &&
      !Boolean(rows[0].is_usage_alert_confirmed_today),
    usageAlertConfirmed: Boolean(rows[0].is_usage_alert_confirmed_today),
    planStartedAt: rows[0].plan_started_at,
    planExpiresAt: rows[0].plan_expires_at,
    limits: {
      maxUploadMb: config.maxUploadMb,
      maxRecordSeconds: config.maxRecordSeconds,
      maxFileSeconds: config.maxFileSeconds,
    },
  };
}

async function getUsageSeconds(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(duration), 0)::float AS used_seconds
     FROM transcriptions WHERE user_id = $1`,
    [userId],
  );
  return Math.max(0, Math.round(Number(rows[0]?.used_seconds || 0)));
}

async function getQuotaStatus(userId) {
  const billing = await getUserBilling(userId);
  const usedSeconds = await getUsageSeconds(userId);
  const remainingSeconds = Math.max(0, billing.quotaSeconds - usedSeconds);
  const percentUsed =
    billing.quotaSeconds > 0
      ? Math.min(100, Math.round((usedSeconds / billing.quotaSeconds) * 100))
      : 100;

  return {
    ...billing,
    usedSeconds,
    remainingSeconds,
    percentUsed,
    isLimitReached: remainingSeconds <= 0,
    shouldAlert:
      remainingSeconds > 0 && remainingSeconds <= billing.alertSeconds,
  };
}

function getUsageAlertConfirmUrl(token) {
  return `${BACKEND_URL.replace(/\/$/, "")}/api/auth/usage-alert/confirm?token=${token}`;
}

async function sendUsageAlertEmail(email, confirmUrl) {
  const smtpHost = getEnvString("SMTP_HOST");
  const smtpUser = getEnvString("SMTP_USER");
  const smtpPass = normalizeSmtpPassword(getEnvString("SMTP_PASS"));
  const smtpFrom = getEnvString("SMTP_FROM", smtpUser);
  const smtpFromName = getEnvString("SMTP_FROM_NAME", "Vbee");

  if (!nodemailer || !smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      `[Usage alert] Email is not configured or nodemailer is not installed. Confirm URL for ${email}: ${confirmUrl}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: getEnvInt("SMTP_PORT", 587),
    secure: getEnvBool("SMTP_SECURE", false),
    requireTLS: getEnvBool("SMTP_REQUIRE_TLS", getEnvInt("SMTP_PORT", 587) === 587),
    connectionTimeout: getEnvInt("SMTP_CONNECTION_TIMEOUT_MS", 10000),
    greetingTimeout: getEnvInt("SMTP_GREETING_TIMEOUT_MS", 10000),
    socketTimeout: getEnvInt("SMTP_SOCKET_TIMEOUT_MS", 15000),
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: smtpFromName ? `"${smtpFromName}" <${smtpFrom}>` : smtpFrom,
    to: email,
    subject: "Xác nhận tiếp tục sử dụng Vbee",
    text: [
      "Tài khoản của bạn đã đạt ngưỡng sử dụng trong ngày.",
      "Vui lòng mở liên kết dưới đây để xác nhận và tiếp tục chuyển giọng nói hôm nay:",
      confirmUrl,
    ].join("\n\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin:0 0 12px">Xác nhận tiếp tục sử dụng Vbee</h2>
        <p>Tài khoản của bạn đã đạt ngưỡng sử dụng trong ngày.</p>
        <p>Nhấn nút bên dưới để xác nhận và tiếp tục chuyển giọng nói hôm nay.</p>
        <p>
          <a href="${confirmUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none">
            Xác nhận tiếp tục
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280">Nếu nút không hoạt động, hãy mở liên kết này: ${confirmUrl}</p>
      </div>
    `,
  });
  return true;
}

async function issueUsageAlert(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const { rows } = await pool.query(
    `UPDATE users
     SET usage_alert_required = TRUE,
         usage_alert_token = $1,
         usage_alert_sent_at = NOW()
     WHERE id = $2
       AND usage_alert_confirmed_at::date IS DISTINCT FROM CURRENT_DATE
       AND (
         usage_alert_required = FALSE
         OR usage_alert_date IS DISTINCT FROM CURRENT_DATE
         OR usage_alert_sent_at IS NULL
         OR usage_alert_sent_at < NOW() - ($3 * INTERVAL '1 second')
       )
     RETURNING email`,
    [token, userId, DAILY_USAGE_ALERT_EMAIL_COOLDOWN_SECONDS],
  );

  if (!rows[0]) {
    return { emailSent: false, skipped: true };
  }

  const confirmUrl = getUsageAlertConfirmUrl(token);
  let emailSent = false;
  try {
    emailSent = await sendUsageAlertEmail(rows[0].email, confirmUrl);
  } catch (error) {
    console.error("Usage alert email error:", error);
  }

  return { emailSent };
}

async function ensureUsageAlertAllowed(userId, quota = null) {
  const { rows } = await pool.query(
    `SELECT usage_alert_daily_seconds,
            usage_alert_date = CURRENT_DATE AS is_usage_alert_today,
            usage_alert_confirmed_at::date = CURRENT_DATE AS is_usage_alert_confirmed_today
     FROM users
     WHERE id = $1`,
    [userId],
  );

  if (!rows[0]) throw createHttpError(404, "Khong tim thay nguoi dung");

  const usedToday = rows[0].is_usage_alert_today
    ? Number(rows[0].usage_alert_daily_seconds || 0)
    : 0;
  if (
    usedToday < DAILY_USAGE_ALERT_SECONDS ||
    rows[0].is_usage_alert_confirmed_today
  ) {
    return;
  }

  const alert = await issueUsageAlert(userId);
  throw createHttpError(
    403,
    "Tài khoản đã đạt ngưỡng sử dụng trong ngày. Vui lòng xác nhận email để tiếp tục.",
    {
      usageAlert: {
        required: true,
        emailSent: alert.emailSent,
        thresholdSeconds: DAILY_USAGE_ALERT_SECONDS,
      },
      quota,
    },
  );
}

async function recordUsageAlertSeconds(userId, durationSeconds) {
  const duration = Math.max(0, Math.ceil(Number(durationSeconds || 0)));
  if (duration <= 0) return { emailSent: false, shouldSendAlert: false };

  const { rows } = await pool.query(
    `UPDATE users
     SET usage_alert_daily_seconds =
           CASE
             WHEN usage_alert_date = CURRENT_DATE
             THEN usage_alert_daily_seconds + $1
             ELSE $1
           END,
         usage_alert_required =
           CASE WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_required ELSE FALSE END,
         usage_alert_token =
           CASE WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_token ELSE NULL END,
         usage_alert_sent_at =
           CASE WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_sent_at ELSE NULL END,
         usage_alert_confirmed_at =
           CASE WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_confirmed_at ELSE NULL END,
         usage_alert_date = CURRENT_DATE
     WHERE id = $2
     RETURNING usage_alert_daily_seconds,
               usage_alert_required,
               usage_alert_confirmed_at::date = CURRENT_DATE AS is_usage_alert_confirmed_today`,
    [duration, userId],
  );

  const updated = rows[0];
  const shouldSendAlert =
    updated &&
    Number(updated.usage_alert_daily_seconds || 0) >= DAILY_USAGE_ALERT_SECONDS &&
    !Boolean(updated.usage_alert_required) &&
    !Boolean(updated.is_usage_alert_confirmed_today);

  if (!shouldSendAlert) {
    return { emailSent: false, shouldSendAlert: false };
  }

  const alert = await issueUsageAlert(userId);
  return { emailSent: alert.emailSent, shouldSendAlert: true };
}

async function confirmUsageAlertToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;

  const { rows } = await pool.query(
    `UPDATE users
     SET usage_alert_required = FALSE,
         usage_alert_token = NULL,
         usage_alert_confirmed_at = NOW()
     WHERE usage_alert_token = $1
       AND usage_alert_date = CURRENT_DATE
     RETURNING id, email`,
    [cleanToken],
  );

  return rows[0] || null;
}

async function validateBeforeTranscription({
  userId,
  file,
  source = "upload",
  expectedDurationSeconds = null,
}) {
  const quota = await getQuotaStatus(userId);
  await ensureUsageAlertAllowed(userId, quota);
  const fileSizeMb = file?.size ? file.size / 1024 / 1024 : 0;
  const expected =
    expectedDurationSeconds !== null && expectedDurationSeconds !== undefined
      ? Math.ceil(Number(expectedDurationSeconds))
      : null;

  if (quota.isLimitReached) {
    throw createHttpError(
      402,
      "Tài khoản đã hết thời lượng. Vui lòng mua hoặc nâng cấp gói cước để tiếp tục.",
      { quota },
    );
  }

  if (fileSizeMb > quota.limits.maxUploadMb) {
    throw createHttpError(
      413,
      `File quá lớn cho gói ${quota.label}. Tối đa ${quota.limits.maxUploadMb}MB.`,
      { quota },
    );
  }

  if (source === "recording" && expected && expected > quota.limits.maxRecordSeconds) {
    throw createHttpError(
      400,
      `Bản ghi vượt giới hạn ${Math.floor(quota.limits.maxRecordSeconds / 60)} phút của gói ${quota.label}.`,
      { quota },
    );
  }

  if (expected && expected > quota.remainingSeconds) {
    throw createHttpError(
      402,
      `Thời lượng còn lại không đủ. Bạn còn khoảng ${Math.floor(quota.remainingSeconds / 60)} phút.`,
      { quota },
    );
  }

  return quota;
}

async function validateAfterTranscription({ userId, durationSeconds, source = "upload" }) {
  const quota = await getQuotaStatus(userId);
  const duration = Math.ceil(Number(durationSeconds || 0));

  if (duration <= 0) return quota;

  if (duration > quota.limits.maxFileSeconds) {
    throw createHttpError(
      400,
      `File vượt giới hạn thời lượng ${Math.floor(quota.limits.maxFileSeconds / 60)} phút của gói ${quota.label}.`,
      { quota },
    );
  }

  if (source === "recording" && duration > quota.limits.maxRecordSeconds) {
    throw createHttpError(
      400,
      `Bản ghi vượt giới hạn ${Math.floor(quota.limits.maxRecordSeconds / 60)} phút của gói ${quota.label}.`,
      { quota },
    );
  }

  if (duration > quota.remainingSeconds) {
    throw createHttpError(
      402,
      "Thời lượng của file vượt quá quota còn lại. Vui lòng mua hoặc nâng cấp gói cước.",
      { quota },
    );
  }

  await recordUsageAlertSeconds(userId, duration);
  return getQuotaStatus(userId);
}

async function updateQuotaAlert(userId, alertSeconds) {
  const raw = Math.round(Number(alertSeconds));
  const clean = Number.isFinite(raw)
    ? Math.max(60, Math.min(24 * 60 * 60, raw))
    : DEFAULT_ALERT_SECONDS;
  await pool.query(
    `UPDATE users SET quota_alert_seconds = $1 WHERE id = $2`,
    [clean, userId],
  );
  return getQuotaStatus(userId);
}

async function upgradeUserPlan(userId, plan = "special", billingCycle = "monthly") {
  const planName = normalizePlan(plan);
  const cleanBillingCycle = normalizeBillingCycle(billingCycle);
  const quotaSeconds = getPurchasedQuotaSeconds(planName, cleanBillingCycle);
  const expiresAt =
    planName === "free"
      ? null
      : new Date(
          Date.now() +
            (cleanBillingCycle === "yearly" ? 365 : 30) *
              24 *
              60 *
              60 *
              1000,
        );

  await pool.query(
    `UPDATE users
     SET plan = $1,
         quota_seconds = $2,
         plan_started_at = NOW(),
         plan_expires_at = $3
     WHERE id = $4`,
    [planName, quotaSeconds, expiresAt, userId],
  );
  return getQuotaStatus(userId);
}

module.exports = {
  PLAN_CONFIG,
  DEFAULT_ALERT_SECONDS,
  DAILY_USAGE_ALERT_SECONDS,
  createHttpError,
  normalizePlan,
  normalizeBillingCycle,
  getPurchasedQuotaSeconds,
  getQuotaStatus,
  issueUsageAlert,
  confirmUsageAlertToken,
  updateQuotaAlert,
  upgradeUserPlan,
  validateBeforeTranscription,
  validateAfterTranscription,
};
