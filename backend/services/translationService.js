require("dotenv").config();

const TRANSLATION_BASE_URL = (
  process.env.LIBRETRANSLATE_API_URL || "https://libretranslate.com"
).replace(/\/$/, "");
const GOOGLE_TRANSLATE_BASE_URL = (
  process.env.GOOGLE_TRANSLATE_API_URL ||
  "https://translation.googleapis.com/language/translate/v2"
).replace(/\/$/, "");
const MYMEMORY_BASE_URL = (
  process.env.MYMEMORY_API_URL || "https://api.mymemory.translated.net"
).replace(/\/$/, "");
const GOOGLE_MAX_CHARS = 4500;
const MYMEMORY_MAX_BYTES = 450;
const TRANSLATION_REQUEST_TIMEOUT_MS = Math.max(
  5_000,
  Number.parseInt(process.env.TRANSLATION_REQUEST_TIMEOUT_MS || "30000", 10),
);
const MAX_TRANSLATION_CHARS = Math.max(
  1_000,
  Number.parseInt(process.env.MAX_TRANSLATION_CHARS || "200000", 10),
);

function createTranslationError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeLanguageCode(value, fallback = "auto") {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean || clean === "none" || clean === "original") return fallback;
  if (clean === "auto" || clean === "multi") return clean;
  return /^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(clean) ? clean : fallback;
}

function normalizeTranslateTarget(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean || clean === "none" || clean === "original") return "";
  return /^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(clean) ? clean : "";
}

function getTextByteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function splitTextByLimit(text, maxLength, getLength = (value) => value.length) {
  const chunks = [];
  let current = "";
  const pieces = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/(\n+|(?<=[.!?。！？])\s+)/u)
    .filter(Boolean);

  for (const piece of pieces) {
    if (getLength(piece) > maxLength) {
      for (const word of piece.split(/(\s+)/).filter(Boolean)) {
        const next = current ? current + word : word;
        if (getLength(next) > maxLength && current) {
          chunks.push(current.trim());
          current = word.trimStart();
        } else {
          current = next;
        }
      }
      continue;
    }

    const next = current ? current + piece : piece;
    if (getLength(next) > maxLength && current) {
      chunks.push(current.trim());
      current = piece.trimStart();
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

function splitTextForGoogle(text) {
  return splitTextByLimit(text, GOOGLE_MAX_CHARS);
}

function splitTextForMyMemory(text) {
  return splitTextByLimit(text, MYMEMORY_MAX_BYTES, getTextByteLength);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getProviderPreference() {
  return String(process.env.TRANSLATION_PROVIDER || "auto")
    .trim()
    .toLowerCase();
}

function getGoogleLanguage(value, fallback = "") {
  const clean = normalizeLanguageCode(value, fallback);
  if (clean === "auto" || clean === "multi") return "";
  if (clean === "zh") return "zh-CN";
  return clean;
}

function getMyMemoryLanguage(value, fallback = "vi") {
  const clean = normalizeLanguageCode(value, fallback);
  if (clean === "auto" || clean === "multi") {
    return normalizeLanguageCode(process.env.DEEPGRAM_LANGUAGE, fallback);
  }
  if (clean === "zh") return "zh-CN";
  return clean;
}

function shouldTranslate({ text, sourceLanguage, targetLanguage }) {
  const target = normalizeTranslateTarget(targetLanguage);
  if (!target || !String(text || "").trim()) return false;
  const source = normalizeLanguageCode(sourceLanguage, "auto");
  return source === "auto" || source === "multi" || source !== target;
}

async function translateWithGoogleCloud({
  text,
  sourceLanguage = "auto",
  targetLanguage,
}) {
  if (typeof fetch !== "function") {
    throw createTranslationError(
      "Dịch văn bản cần Node.js 18+ để dùng fetch.",
      503,
    );
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw createTranslationError(
      "Chưa cấu hình GOOGLE_TRANSLATE_API_KEY trong backend/.env",
      503,
    );
  }

  const target = getGoogleLanguage(targetLanguage);
  if (!target) return null;

  const source = getGoogleLanguage(sourceLanguage);
  const chunks = splitTextForGoogle(text);
  if (chunks.length === 0) return null;

  const payload = {
    q: chunks,
    target,
    format: "text",
  };
  if (source) payload.source = source;

  const params = new URLSearchParams({ key: apiKey });
  const response = await fetch(`${GOOGLE_TRANSLATE_BASE_URL}?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TRANSLATION_REQUEST_TIMEOUT_MS),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createTranslationError(
      body.error?.message ||
        body.error ||
        body.message ||
        `Google Cloud Translation lỗi ${response.status}`,
      response.status,
    );
  }

  const translations = body.data?.translations || [];
  const translatedText = translations
    .map((item) => decodeHtmlEntities(item.translatedText || ""))
    .join("\n\n");

  return {
    provider: "google-cloud-translation",
    text: translatedText,
    sourceLanguage: translations[0]?.detectedSourceLanguage || source || "auto",
    targetLanguage: target,
  };
}

async function translateWithLibreTranslate({
  text,
  sourceLanguage = "auto",
  targetLanguage,
}) {
  if (typeof fetch !== "function") {
    throw createTranslationError(
      "Dịch văn bản cần Node.js 18+ để dùng fetch.",
      503,
    );
  }

  const target = normalizeTranslateTarget(targetLanguage);
  if (!target) return null;

  const payload = {
    q: text,
    source:
      normalizeLanguageCode(sourceLanguage, "auto") === "multi"
        ? "auto"
        : normalizeLanguageCode(sourceLanguage, "auto"),
    target,
    format: "text",
  };

  if (process.env.LIBRETRANSLATE_API_KEY) {
    payload.api_key = process.env.LIBRETRANSLATE_API_KEY;
  }

  const response = await fetch(`${TRANSLATION_BASE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TRANSLATION_REQUEST_TIMEOUT_MS),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createTranslationError(
      body.error ||
        body.message ||
        `Dịch văn bản thất bại với mã ${response.status}. Kiểm tra LIBRETRANSLATE_API_URL hoặc LIBRETRANSLATE_API_KEY.`,
      response.status,
    );
  }

  const translatedText = body.translatedText || body.translated_text || "";
  return {
    provider: "libretranslate",
    text: translatedText,
    sourceLanguage:
      body.detectedLanguage?.language ||
      body.detected_language?.language ||
      payload.source,
    targetLanguage: target,
  };
}

async function translateWithMyMemory({
  text,
  sourceLanguage = "auto",
  targetLanguage,
}) {
  const source = getMyMemoryLanguage(sourceLanguage);
  const target = getMyMemoryLanguage(targetLanguage, "");
  if (!target) return null;

  const chunks = splitTextForMyMemory(text);
  if (chunks.length === 0) return null;
  if (chunks.length > 100) {
    throw createTranslationError(
      "Transcript quá dài cho MyMemory. Hãy cấu hình Google Cloud Translation.",
      413,
    );
  }

  const translatedChunks = [];
  for (const chunk of chunks) {
    const params = new URLSearchParams({
      q: chunk,
      langpair: `${source}|${target}`,
      mt: "1",
    });
    if (process.env.MYMEMORY_EMAIL) {
      params.set("de", process.env.MYMEMORY_EMAIL);
    }

    const response = await fetch(`${MYMEMORY_BASE_URL}/get?${params}`, {
      signal: AbortSignal.timeout(TRANSLATION_REQUEST_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || Number(body.responseStatus || 200) >= 400) {
      const providerMessage = String(
        body.responseDetails || body.message || "",
      );
      if (/used all available free translations/i.test(providerMessage)) {
        throw createTranslationError(
          "MyMemory đã hết quota dịch miễn phí trong ngày. Vui lòng dùng AssemblyAI hoặc Google Cloud Translation.",
          429,
        );
      }
      throw createTranslationError(
        providerMessage ||
          `MyMemory dịch thất bại với mã ${response.status}`,
        response.status || 502,
      );
    }

    const translatedText = body.responseData?.translatedText || "";
    translatedChunks.push(translatedText);
  }

  return {
    provider: "mymemory",
    text: translatedChunks.join("\n\n"),
    sourceLanguage: source,
    targetLanguage: target,
  };
}

async function translateTranscript({
  text,
  sourceLanguage = "auto",
  targetLanguage,
}) {
  if (!shouldTranslate({ text, sourceLanguage, targetLanguage })) return null;
  if (String(text).length > MAX_TRANSLATION_CHARS) {
    throw createTranslationError(
      `Transcript vượt giới hạn dịch ${MAX_TRANSLATION_CHARS.toLocaleString("vi-VN")} ký tự.`,
      413,
    );
  }

  const providerPreference = getProviderPreference();
  const shouldUseGoogle =
    providerPreference === "google" ||
    providerPreference === "google-cloud" ||
    providerPreference === "google-cloud-translation" ||
    Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);
  const shouldUseLibreTranslate =
    providerPreference === "libretranslate" ||
    Boolean(process.env.LIBRETRANSLATE_API_KEY) ||
    TRANSLATION_BASE_URL !== "https://libretranslate.com";
  const errors = [];

  if (shouldUseGoogle) {
    try {
      return await translateWithGoogleCloud({
        text,
        sourceLanguage,
        targetLanguage,
      });
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (shouldUseLibreTranslate) {
    try {
      return await translateWithLibreTranslate({
        text,
        sourceLanguage,
        targetLanguage,
      });
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (providerPreference === "mymemory" || providerPreference === "auto") {
    try {
      return await translateWithMyMemory({
        text,
        sourceLanguage,
        targetLanguage,
      });
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length === 0) {
    try {
      return await translateWithMyMemory({
        text,
        sourceLanguage,
        targetLanguage,
      });
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw createTranslationError(
    `Không dịch được transcript. ${errors.join(" ")}`,
    502,
  );
}

module.exports = {
  normalizeLanguageCode,
  normalizeTranslateTarget,
  shouldTranslate,
  translateTranscript,
};
