const crypto = require("crypto");

const PAYOS_API_BASE_URL = (
  process.env.PAYOS_API_BASE_URL || "https://api-merchant.payos.vn"
).replace(/\/$/, "");
const PAYOS_REQUEST_TIMEOUT_MS = Math.max(
  5_000,
  Number.parseInt(process.env.PAYOS_REQUEST_TIMEOUT_MS || "15000", 10),
);

function createPayosError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getPayosConfig() {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    throw createPayosError(
      "Chưa cấu hình PayOS. Hãy thêm PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY vào backend/.env.",
      503,
    );
  }

  return { clientId, apiKey, checksumKey };
}

function sortObjectByKey(object) {
  return Object.keys(object || {})
    .sort()
    .reduce((result, key) => {
      result[key] = object[key];
      return result;
    }, {});
}

function normalizeSignatureValue(value) {
  if ([null, undefined, "undefined", "null"].includes(value)) return "";
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) =>
        item && typeof item === "object" ? sortObjectByKey(item) : item,
      ),
    );
  }
  return String(value);
}

function toSignatureData(object) {
  const sorted = sortObjectByKey(object);
  return Object.keys(sorted)
    .filter((key) => sorted[key] !== undefined)
    .map((key) => `${key}=${normalizeSignatureValue(sorted[key])}`)
    .join("&");
}

function createSignature(data, checksumKey) {
  return crypto
    .createHmac("sha256", checksumKey)
    .update(toSignatureData(data))
    .digest("hex");
}

function signaturesMatch(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string") return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

async function readPayosResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createPayosError("PayOS trả về dữ liệu không hợp lệ");
  }

  if (!response.ok || payload?.code !== "00" || !payload?.data) {
    throw createPayosError(
      payload?.desc || "PayOS không thể tạo yêu cầu thanh toán",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  return payload.data;
}

async function createPaymentLink({
  orderCode,
  amount,
  description,
  itemName,
  returnUrl,
  cancelUrl,
  expiresAt,
}) {
  const { clientId, apiKey, checksumKey } = getPayosConfig();
  const signaturePayload = {
    amount,
    cancelUrl,
    description,
    orderCode,
    returnUrl,
  };
  const payload = {
    ...signaturePayload,
    items: [{ name: itemName, quantity: 1, price: amount }],
    expiredAt: Math.floor(expiresAt.getTime() / 1000),
    signature: createSignature(signaturePayload, checksumKey),
  };

  const response = await fetch(`${PAYOS_API_BASE_URL}/v2/payment-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(PAYOS_REQUEST_TIMEOUT_MS),
  });

  return readPayosResponse(response);
}

async function getPaymentLinkInformation(orderCode) {
  const { clientId, apiKey } = getPayosConfig();
  const response = await fetch(
    `${PAYOS_API_BASE_URL}/v2/payment-requests/${encodeURIComponent(orderCode)}`,
    {
      headers: {
        "x-client-id": clientId,
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(PAYOS_REQUEST_TIMEOUT_MS),
    },
  );

  return readPayosResponse(response);
}

function verifyWebhook(webhook) {
  const { checksumKey } = getPayosConfig();
  const data = webhook?.data;
  const receivedSignature = webhook?.signature;

  if (!data || typeof data !== "object" || !receivedSignature) {
    throw createPayosError("Webhook PayOS thiếu dữ liệu hoặc chữ ký", 400);
  }

  const expectedSignature = createSignature(data, checksumKey);
  if (!signaturesMatch(expectedSignature, receivedSignature)) {
    throw createPayosError("Chữ ký webhook PayOS không hợp lệ", 400);
  }

  if (webhook.success !== true || webhook.code !== "00" || data.code !== "00") {
    throw createPayosError("Webhook PayOS không báo giao dịch thành công", 400);
  }

  return data;
}

module.exports = {
  createPaymentLink,
  getPaymentLinkInformation,
  verifyWebhook,
};
