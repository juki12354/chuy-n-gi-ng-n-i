const crypto = require("crypto");

function getSigningSecret() {
  return String(
    process.env.PROVIDER_FILE_SIGNING_SECRET || process.env.JWT_SECRET || "",
  ).trim();
}

function sign(jobId, expiresAt) {
  const secret = getSigningSecret();
  if (!secret) throw new Error("Chưa cấu hình PROVIDER_FILE_SIGNING_SECRET");
  return crypto
    .createHmac("sha256", secret)
    .update(`${jobId}.${expiresAt}`)
    .digest("hex");
}

function createProviderFileUrl(jobId) {
  const baseUrl = String(process.env.PUBLIC_BACKEND_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (!baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl)) {
    const error = new Error(
      "File Sonix trên 100MB cần PUBLIC_BACKEND_URL công khai để Sonix tải file_url.",
    );
    error.statusCode = 503;
    throw error;
  }

  const ttlSeconds = Math.max(
    15 * 60,
    Number.parseInt(process.env.PROVIDER_FILE_URL_TTL_SECONDS || "7200", 10),
  );
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = sign(jobId, expiresAt);
  return `${baseUrl}/api/transcribe/provider-files/${jobId}?expires=${expiresAt}&signature=${signature}`;
}

function verifyProviderFileSignature(jobId, expiresAt, signature) {
  try {
    const expires = Number.parseInt(String(expiresAt || ""), 10);
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const provided = Buffer.from(String(signature || ""), "hex");
    const expected = Buffer.from(sign(jobId, expires), "hex");
    return (
      provided.length === expected.length &&
      provided.length > 0 &&
      crypto.timingSafeEqual(provided, expected)
    );
  } catch {
    return false;
  }
}

module.exports = {
  createProviderFileUrl,
  verifyProviderFileSignature,
};
