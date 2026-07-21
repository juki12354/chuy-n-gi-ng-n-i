const nodemailer = require("nodemailer");
const { IS_PRODUCTION } = require("../config/security");

let transporter;

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USER));
}

function getTransporter() {
  if (transporter) return transporter;
  if (!hasSmtpConfig()) return null;

  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: IS_PRODUCTION && process.env.SMTP_SECURE !== "true",
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  return transporter;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendPasswordResetEmail({ to, firstName, resetUrl, expiresMinutes }) {
  const mailer = getTransporter();
  if (!mailer) return false;

  const safeName = escapeHtml(firstName || "bạn");
  const safeUrl = escapeHtml(resetUrl);
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Đặt lại mật khẩu Vbee AIVoice",
    text: `Xin chào ${firstName || "bạn"},\n\nMở liên kết sau để đặt lại mật khẩu: ${resetUrl}\n\nLiên kết hết hạn sau ${expiresMinutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#21104a;line-height:1.6">
        <h2>Đặt lại mật khẩu Vbee AIVoice</h2>
        <p>Xin chào <strong>${safeName}</strong>,</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới để tiếp tục:</p>
        <p style="margin:28px 0">
          <a href="${safeUrl}" style="background:#ffcb05;color:#21104a;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Đặt lại mật khẩu</a>
        </p>
        <p>Liên kết hết hạn sau ${expiresMinutes} phút và chỉ sử dụng được một lần.</p>
        <p style="color:#756894;font-size:13px">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
      </div>
    `,
  });
  return true;
}

module.exports = { hasSmtpConfig, sendPasswordResetEmail };
