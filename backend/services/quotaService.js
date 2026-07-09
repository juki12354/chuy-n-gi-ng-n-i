const pool = require("../db");

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
    `SELECT id, plan, quota_seconds, quota_alert_seconds, plan_started_at, plan_expires_at
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

async function validateBeforeTranscription({
  userId,
  file,
  source = "upload",
  expectedDurationSeconds = null,
}) {
  const quota = await getQuotaStatus(userId);
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

  return quota;
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
  createHttpError,
  normalizePlan,
  normalizeBillingCycle,
  getPurchasedQuotaSeconds,
  getQuotaStatus,
  updateQuotaAlert,
  upgradeUserPlan,
  validateBeforeTranscription,
  validateAfterTranscription,
};
