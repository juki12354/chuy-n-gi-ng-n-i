const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const {
  ACCESS_TOKEN_TTL_SECONDS,
  IS_PRODUCTION,
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_SECRET,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_DAYS,
} = require("../config/security");

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function hashRequestValue(value) {
  return crypto
    .createHmac(
      "sha256",
      process.env.AUDIT_HASH_SECRET || JWT_SECRET,
    )
    .update(String(value || "unknown"))
    .digest("hex");
}

function getRequestMetadata(req) {
  return {
    ipHash: hashRequestValue(req.ip || req.socket?.remoteAddress),
    userAgent: String(req.get?.("user-agent") || "").slice(0, 500),
  };
}

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    const key = cookie.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function readRefreshToken(req) {
  return readCookie(req, REFRESH_COOKIE_NAME);
}

function setRefreshCookie(res, rawToken) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
  });
}

function createAccessToken(user, sessionId) {
  return jwt.sign(
    {
      email: user.email,
      sid: sessionId,
      ver: Number(user.auth_version || 0),
    },
    JWT_SECRET,
    {
      algorithm: "HS256",
      audience: JWT_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: JWT_ISSUER,
      jwtid: crypto.randomUUID(),
      subject: String(user.id),
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
}

function makeRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

async function insertSession(db, { userId, sessionId, rawToken, req }) {
  const metadata = getRequestMetadata(req);
  await db.query(
    `INSERT INTO auth_refresh_tokens (
       id, user_id, token_hash, expires_at, ip_hash, user_agent
     )
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 day'), $5, $6)`,
    [
      sessionId,
      userId,
      hashToken(rawToken),
      REFRESH_TOKEN_TTL_DAYS,
      metadata.ipHash,
      metadata.userAgent,
    ],
  );
}

async function issueSession(user, req, res, db = pool) {
  const sessionId = crypto.randomUUID();
  const rawToken = makeRefreshToken();
  await insertSession(db, { userId: user.id, sessionId, rawToken, req });
  setRefreshCookie(res, rawToken);
  return {
    token: createAccessToken(user, sessionId),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    sessionId,
  };
}

async function rotateSession(req, res) {
  const rawToken = readRefreshToken(req);
  if (!rawToken) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT session.*, account.email, account.auth_version
       FROM auth_refresh_tokens session
       JOIN users account ON account.id = session.user_id
       WHERE session.token_hash = $1
       FOR UPDATE OF session, account`,
      [hashToken(rawToken)],
    );
    const current = rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      clearRefreshCookie(res);
      return null;
    }

    if (current.revoked_at) {
      const rotationAgeMs = Date.now() - new Date(current.revoked_at).getTime();
      if (current.replaced_by && rotationAgeMs >= 0 && rotationAgeMs <= 30_000) {
        await client.query("ROLLBACK");
        return { retry: true };
      }
      await client.query(
        "UPDATE auth_refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1",
        [current.user_id],
      );
      await client.query(
        "UPDATE users SET auth_version = auth_version + 1 WHERE id = $1",
        [current.user_id],
      );
      await client.query("COMMIT");
      clearRefreshCookie(res);
      return null;
    }

    if (new Date(current.expires_at).getTime() <= Date.now()) {
      await client.query(
        "UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE id = $1",
        [current.id],
      );
      await client.query("COMMIT");
      clearRefreshCookie(res);
      return null;
    }

    const nextSessionId = crypto.randomUUID();
    const nextRawToken = makeRefreshToken();
    await client.query(
      "UPDATE auth_refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE id = $1",
      [current.id, nextSessionId],
    );
    await insertSession(client, {
      userId: current.user_id,
      sessionId: nextSessionId,
      rawToken: nextRawToken,
      req,
    });
    await client.query("COMMIT");

    setRefreshCookie(res, nextRawToken);
    return {
      userId: current.user_id,
      token: createAccessToken(
        {
          id: current.user_id,
          email: current.email,
          auth_version: current.auth_version,
        },
        nextSessionId,
      ),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      sessionId: nextSessionId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function revokeSession(sessionId, userId, res) {
  if (sessionId && userId) {
    await pool.query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
  }
  clearRefreshCookie(res);
}

async function revokeRefreshToken(req, res) {
  const rawToken = readRefreshToken(req);
  let revoked = null;
  if (rawToken) {
    const { rows } = await pool.query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE token_hash = $1
       RETURNING id, user_id`,
      [hashToken(rawToken)],
    );
    revoked = rows[0] || null;
  }
  clearRefreshCookie(res);
  return revoked;
}

async function revokeAllSessions(userId, db = pool) {
  await db.query(
    "UPDATE auth_refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1",
    [userId],
  );
}

module.exports = {
  clearRefreshCookie,
  hashToken,
  issueSession,
  readCookie,
  readRefreshToken,
  revokeAllSessions,
  revokeRefreshToken,
  revokeSession,
  rotateSession,
  verifyAccessToken,
};
