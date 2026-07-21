const pool = require("../db");

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const REFERRAL_REWARD_SECONDS = positiveInt(
  process.env.REFERRAL_REWARD_SECONDS,
  100 * 60,
);
const REFERRAL_REWARD_VALID_DAYS = positiveInt(
  process.env.REFERRAL_REWARD_VALID_DAYS,
  90,
);
const REFERRAL_CLAIM_WINDOW_MINUTES = positiveInt(
  process.env.REFERRAL_CLAIM_WINDOW_MINUTES,
  30,
);

function referralCodeForUserId(userId) {
  const cleanId = String(userId || "").replace(/\D/g, "");
  return `VBEE-${cleanId.padStart(6, "0")}`;
}

function normalizeReferralCode(value) {
  const clean = String(value || "").trim().toUpperCase();
  return /^VBEE-[A-Z0-9]{6,20}$/.test(clean) ? clean : "";
}

async function ensureReferralCode(userId, db = pool) {
  const fallbackCode = referralCodeForUserId(userId);
  const { rows } = await db.query(
    `UPDATE users
     SET referral_code = COALESCE(NULLIF(BTRIM(referral_code), ''), $2)
     WHERE id = $1
     RETURNING referral_code`,
    [userId, fallbackCode],
  );
  return rows[0]?.referral_code || fallbackCode;
}

async function registerReferralForNewUser(referredUserId, rawCode) {
  const referralCode = normalizeReferralCode(rawCode);
  if (!referralCode) return { registered: false, reason: "invalid_code" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const referredResult = await client.query(
      `SELECT id, created_at
       FROM users
       WHERE id = $1
         AND created_at >= NOW() - ($2 * INTERVAL '1 minute')
       FOR UPDATE`,
      [referredUserId, REFERRAL_CLAIM_WINDOW_MINUTES],
    );
    if (!referredResult.rows[0]) {
      await client.query("ROLLBACK");
      return { registered: false, reason: "claim_window_expired" };
    }

    const referrerResult = await client.query(
      `SELECT id FROM users WHERE referral_code = $1 FOR UPDATE`,
      [referralCode],
    );
    const referrerId = referrerResult.rows[0]?.id;
    if (!referrerId || Number(referrerId) === Number(referredUserId)) {
      await client.query("ROLLBACK");
      return { registered: false, reason: "invalid_code" };
    }

    const { rows } = await client.query(
      `INSERT INTO referrals (
         referrer_id, referred_user_id, referral_code, status, reward_seconds
       ) VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (referred_user_id) DO NOTHING
       RETURNING id, status`,
      [referrerId, referredUserId, referralCode, REFERRAL_REWARD_SECONDS],
    );
    await client.query("COMMIT");
    return rows[0]
      ? { registered: true, status: rows[0].status }
      : { registered: false, reason: "already_registered" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rewardReferralAfterFirstUsage(referredUserId, db = pool) {
  const { rows } = await db.query(
    `SELECT id, referrer_id, reward_seconds
     FROM referrals
     WHERE referred_user_id = $1 AND status = 'pending'
     FOR UPDATE`,
    [referredUserId],
  );
  const referral = rows[0];
  if (!referral) return { rewarded: false };

  const rewardResult = await db.query(
    `UPDATE referrals
     SET status = 'rewarded', rewarded_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [referral.id],
  );
  if (!rewardResult.rows[0]) return { rewarded: false };

  await db.query(
    `INSERT INTO top_up_credits (
       user_id, billing_order_id, referral_id, product_code,
       seconds_granted, remaining_seconds, starts_at, expires_at
     ) VALUES (
       $1, NULL, $2, 'referral_100m', $3, $3, NOW(),
       NOW() + ($4 * INTERVAL '1 day')
     )
     ON CONFLICT (referral_id) DO NOTHING`,
    [
      referral.referrer_id,
      referral.id,
      Number(referral.reward_seconds),
      REFERRAL_REWARD_VALID_DAYS,
    ],
  );

  return {
    rewarded: true,
    referrerId: referral.referrer_id,
    rewardSeconds: Number(referral.reward_seconds),
  };
}

async function getReferralSummary(userId, db = pool) {
  const referralCode = await ensureReferralCode(userId, db);
  const { rows } = await db.query(
    `SELECT
       COUNT(referral.id)::integer AS joined_count,
       COUNT(referral.id) FILTER (WHERE referral.status = 'pending')::integer AS pending_count,
       COUNT(referral.id) FILTER (WHERE referral.status = 'rewarded')::integer AS rewarded_count,
       COALESCE(SUM(referral.reward_seconds) FILTER (
         WHERE referral.status = 'rewarded'
       ), 0)::integer AS earned_seconds,
       COALESCE(SUM(credit.remaining_seconds) FILTER (
         WHERE credit.expires_at > NOW()
       ), 0)::integer AS available_seconds,
       MIN(credit.expires_at) FILTER (
         WHERE credit.remaining_seconds > 0 AND credit.expires_at > NOW()
       ) AS next_expiry
     FROM users account
     LEFT JOIN referrals referral ON referral.referrer_id = account.id
     LEFT JOIN top_up_credits credit ON credit.referral_id = referral.id
     WHERE account.id = $1
     GROUP BY account.id`,
    [userId],
  );
  const summary = rows[0] || {};
  return {
    referralCode,
    rewardMinutes: Math.floor(REFERRAL_REWARD_SECONDS / 60),
    rewardValidDays: REFERRAL_REWARD_VALID_DAYS,
    joinedCount: Number(summary.joined_count || 0),
    pendingCount: Number(summary.pending_count || 0),
    rewardedCount: Number(summary.rewarded_count || 0),
    earnedMinutes: Math.floor(Number(summary.earned_seconds || 0) / 60),
    availableMinutes: Math.floor(Number(summary.available_seconds || 0) / 60),
    nextExpiry: summary.next_expiry || null,
  };
}

module.exports = {
  REFERRAL_REWARD_SECONDS,
  REFERRAL_REWARD_VALID_DAYS,
  ensureReferralCode,
  getReferralSummary,
  normalizeReferralCode,
  referralCodeForUserId,
  registerReferralForNewUser,
  rewardReferralAfterFirstUsage,
};
