const crypto = require("crypto");
const pool = require("../db");
const { JWT_SECRET } = require("../config/security");

const REDACTED_KEYS = /token|secret|password|authorization|cookie|api.?key/i;

function redactMetadata(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactMetadata(item, depth + 1));
  }
  if (typeof value !== "object") return String(value).slice(0, 500);
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    result[key] = REDACTED_KEYS.test(key)
      ? "[redacted]"
      : redactMetadata(item, depth + 1);
  }
  return result;
}

function hashIp(req) {
  return crypto
    .createHmac("sha256", process.env.AUDIT_HASH_SECRET || JWT_SECRET)
    .update(String(req?.ip || req?.socket?.remoteAddress || "unknown"))
    .digest("hex");
}

async function writeSecurityAudit({
  event,
  outcome,
  req,
  userId = null,
  sessionId = null,
  metadata = {},
}) {
  const record = {
    event: String(event || "unknown").slice(0, 100),
    outcome: String(outcome || "unknown").slice(0, 20),
    userId: Number.isInteger(Number(userId)) ? Number(userId) : null,
    sessionId: sessionId ? String(sessionId).slice(0, 100) : null,
    requestId: req?.requestId || null,
    ipHash: hashIp(req),
    userAgent: String(req?.get?.("user-agent") || "").slice(0, 500),
    metadata: redactMetadata(metadata),
  };

  try {
    await pool.query(
      `INSERT INTO security_audit_events (
         event_type, outcome, user_id, session_id, request_id,
         ip_hash, user_agent, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        record.event,
        record.outcome,
        record.userId,
        record.sessionId,
        record.requestId,
        record.ipHash,
        record.userAgent,
        JSON.stringify(record.metadata || {}),
      ],
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        type: "security_audit_write_failed",
        event: record.event,
        requestId: record.requestId,
        message: error.message,
      }),
    );
  }
}

module.exports = { writeSecurityAudit };
