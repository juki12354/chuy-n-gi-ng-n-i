const crypto = require("crypto");

const ENCRYPTED_PREFIX = "enc:v1:";

function getEncryptionKey() {
  const secret =
    process.env.PROVIDER_SECRET_KEY ||
    process.env.JWT_SECRET ||
    "change-this-secret-in-production";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptProviderSecret(value) {
  const secret = String(value || "").trim();
  if (!secret) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
  return `${ENCRYPTED_PREFIX}${payload}`;
}

function decryptProviderSecret(value) {
  const secret = String(value || "").trim();
  if (!secret) return "";
  if (!secret.startsWith(ENCRYPTED_PREFIX)) return secret;

  const payload = Buffer.from(secret.slice(ENCRYPTED_PREFIX.length), "base64url");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = {
  decryptProviderSecret,
  encryptProviderSecret,
};
