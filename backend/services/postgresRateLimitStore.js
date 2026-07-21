const crypto = require("crypto");
const pool = require("../db");
const { JWT_SECRET } = require("../config/security");

function hashKey(key) {
  return crypto
    .createHmac("sha256", process.env.AUDIT_HASH_SECRET || JWT_SECRET)
    .update(String(key))
    .digest("hex");
}

class PostgresRateLimitStore {
  constructor(namespace) {
    this.namespace = String(namespace).slice(0, 80);
    this.windowMs = 60_000;
    this.localKeys = false;
    this.prefix = `pg:${this.namespace}:`;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const windowSeconds = Math.max(1, Math.ceil(this.windowMs / 1000));
    const { rows } = await pool.query(
      `WITH bucket AS (
         SELECT to_timestamp(
           FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / $3::numeric) * $3::numeric
         ) AS started_at
       )
       INSERT INTO rate_limit_counters (
         namespace, key_hash, window_started_at, reset_at, total_hits
       )
       SELECT $1, $2, bucket.started_at,
              bucket.started_at + ($3::integer * INTERVAL '1 second'), 1
       FROM bucket
       ON CONFLICT (namespace, key_hash, window_started_at)
       DO UPDATE SET total_hits = rate_limit_counters.total_hits + 1
       RETURNING total_hits, reset_at`,
      [this.namespace, hashKey(key), windowSeconds],
    );
    return {
      totalHits: Number(rows[0].total_hits),
      resetTime: new Date(rows[0].reset_at),
    };
  }

  async decrement(key) {
    await pool.query(
      `UPDATE rate_limit_counters
       SET total_hits = GREATEST(0, total_hits - 1)
       WHERE namespace = $1 AND key_hash = $2 AND reset_at > NOW()`,
      [this.namespace, hashKey(key)],
    );
  }

  async resetKey(key) {
    await pool.query(
      "DELETE FROM rate_limit_counters WHERE namespace = $1 AND key_hash = $2",
      [this.namespace, hashKey(key)],
    );
  }

  async get(key) {
    const { rows } = await pool.query(
      `SELECT total_hits, reset_at
       FROM rate_limit_counters
       WHERE namespace = $1 AND key_hash = $2 AND reset_at > NOW()
       ORDER BY reset_at DESC LIMIT 1`,
      [this.namespace, hashKey(key)],
    );
    if (!rows[0]) return undefined;
    return {
      totalHits: Number(rows[0].total_hits),
      resetTime: new Date(rows[0].reset_at),
    };
  }
}

module.exports = { PostgresRateLimitStore };
