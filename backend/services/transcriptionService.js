require("dotenv").config();
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ffmpegStaticPath = require("ffmpeg-static");
const { AssemblyAI } = require("assemblyai");
const pool = require("../db");
const {
  normalizeLanguageCode,
  normalizeTranslateTarget,
  translateTranscript,
} = require("./translationService");

const ALLOWED_EXT = /\.(mp3|wav|m4a|ogg|flac|aac|mp4|webm)$/i;
const MAX_SIZE_MB = Number.parseInt(process.env.MAX_UPLOAD_MB || "200", 10);
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const execFileAsync = promisify(execFile);

const SONIX_API_BASE_URL = (
  process.env.SONIX_API_BASE_URL || "https://api.sonix.ai/v1"
).replace(/\/$/, "");
const SONIX_DIRECT_UPLOAD_MAX_MB = 100;
const SONIX_POLL_INTERVAL_MS = Number.parseInt(
  process.env.SONIX_POLL_INTERVAL_MS || "5000",
  10,
);
const SONIX_TIMEOUT_MS = Number.parseInt(
  process.env.SONIX_TIMEOUT_MS || `${30 * 60 * 1000}`,
  10,
);
const DEEPGRAM_API_BASE_URL = (
  process.env.DEEPGRAM_API_BASE_URL || "https://api.deepgram.com/v1"
).replace(/\/$/, "");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeFilename(originalname = "audio.webm") {
  try {
    return Buffer.from(originalname, "latin1").toString("utf8");
  } catch {
    return originalname;
  }
}

function getSafeExtension(originalname = "") {
  const match = originalname.match(/\.([^.]+)$/);
  const ext = (match?.[1] || "webm").toLowerCase();
  return /^[a-z0-9]+$/.test(ext) ? ext : "webm";
}

function stripExtension(filename = "audio") {
  return filename.replace(/\.[^.]+$/, "") || "audio";
}

function normalizeAudioMode(mode) {
  const clean = String(mode || "")
    .trim()
    .toLowerCase();
  if (["song", "music", "lyrics", "vocal"].includes(clean)) return "song";
  return "speech";
}

function getFfmpegPath() {
  return process.env.FFMPEG_PATH || ffmpegStaticPath || "ffmpeg";
}

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

async function prepareMusicAudioForStt(file, filename) {
  if (process.env.AUDIO_PREPROCESSING_ENABLED === "false") {
    return { file, applied: false, warning: null };
  }

  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    return {
      file,
      applied: false,
      warning: "Chưa có ffmpeg nên chưa thể làm rõ vocal trước khi phiên âm.",
    };
  }

  const tempBase = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = path.join(
    os.tmpdir(),
    `${tempBase}.${getSafeExtension(file.originalname || filename)}`,
  );
  const outputPath = path.join(os.tmpdir(), `${tempBase}-vocal.wav`);
  const filters =
    process.env.SONG_AUDIO_FILTER ||
    "highpass=f=120,lowpass=f=8000,afftdn=nf=-25,dynaudnorm=f=150:g=15,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-16:LRA=11:TP=-1.5";
  const timeout = Number.parseInt(
    process.env.AUDIO_PREPROCESSING_TIMEOUT_MS || `${3 * 60 * 1000}`,
    10,
  );

  try {
    fs.writeFileSync(inputPath, file.buffer);
    await execFileAsync(
      ffmpegPath,
      [
        "-hide_banner",
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-af",
        filters,
        "-f",
        "wav",
        outputPath,
      ],
      { timeout, maxBuffer: 8 * 1024 * 1024 },
    );

    const buffer = fs.readFileSync(outputPath);
    return {
      file: {
        ...file,
        buffer,
        size: buffer.length,
        originalname: `${stripExtension(filename)}-vocal.wav`,
        mimetype: "audio/wav",
      },
      applied: true,
      warning: null,
    };
  } catch (error) {
    return {
      file,
      applied: false,
      warning:
        error.message ||
        "Không xử lý được audio bằng ffmpeg, backend sẽ gửi file gốc cho provider.",
    };
  } finally {
    safeUnlink(inputPath);
    safeUnlink(outputPath);
  }
}

function getTranscriptionProvider() {
  const configured = (process.env.TRANSCRIPTION_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (configured) return configured;
  if (process.env.SONIX_API_KEY) return "sonix";
  if (process.env.DEEPGRAM_API_KEY) return "deepgram";
  return "assemblyai";
}

function assertSupportedProvider(provider) {
  if (!["assemblyai", "sonix", "deepgram"].includes(provider)) {
    throw createHttpError(
      503,
      `TRANSCRIPTION_PROVIDER không hợp lệ: ${provider}. Hỗ trợ: assemblyai, sonix hoặc deepgram.`,
    );
  }
}

function getAssemblyClient() {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    throw createHttpError(
      503,
      "Chưa cấu hình ASSEMBLYAI_API_KEY trong backend/.env",
    );
  }
  return new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
}

function getSonixApiKey() {
  if (!process.env.SONIX_API_KEY) {
    throw createHttpError(
      503,
      "Chưa cấu hình SONIX_API_KEY trong backend/.env",
    );
  }
  return process.env.SONIX_API_KEY;
}

function getDeepgramApiKey() {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw createHttpError(
      503,
      "Chưa cấu hình DEEPGRAM_API_KEY trong backend/.env",
    );
  }
  return process.env.DEEPGRAM_API_KEY;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await response.json();
    if (!response.ok) {
      throw createHttpError(
        response.status,
        body.error?.message ||
          body.error ||
          body.message ||
          `Provider API lỗi ${response.status}`,
      );
    }
    return body;
  }

  const text = await response.text();
  if (!response.ok) {
    throw createHttpError(
      response.status,
      text || `Provider API lỗi ${response.status}`,
    );
  }
  return text;
}

async function sonixRequest(pathname, options = {}) {
  if (
    typeof fetch !== "function" ||
    typeof FormData !== "function" ||
    typeof Blob !== "function"
  ) {
    throw createHttpError(
      503,
      "Sonix provider cần Node.js 18+ để dùng fetch/FormData.",
    );
  }

  const headers = {
    Authorization: `Bearer ${getSonixApiKey()}`,
    ...(options.headers || {}),
  };

  const response = await fetch(`${SONIX_API_BASE_URL}${pathname}`, {
    ...options,
    headers,
  });

  return readResponseBody(response);
}

function getDeepgramLanguage(language) {
  return normalizeLanguageCode(language || process.env.DEEPGRAM_LANGUAGE, "vi");
}

function getDeepgramModel() {
  return (process.env.DEEPGRAM_MODEL || "nova-3").trim();
}

function normalizeDeepgramWords(response) {
  const words =
    response?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  if (!Array.isArray(words)) return [];

  return words.map((word) => ({
    text: word.punctuated_word || word.word || "",
    start: Math.round(Number(word.start || 0) * 1000),
    end: Math.round(Number(word.end || word.start || 0) * 1000),
    speaker:
      word.speaker !== undefined && word.speaker !== null
        ? `Speaker ${word.speaker}`
        : null,
    confidence: word.confidence,
  }));
}

function buildTextFromDeepgram(response, speakerLabels) {
  const alternative = response?.results?.channels?.[0]?.alternatives?.[0];
  if (!alternative) return "";

  const paragraphs = alternative.paragraphs?.paragraphs;
  if (speakerLabels && Array.isArray(paragraphs) && paragraphs.length > 0) {
    return paragraphs
      .map((paragraph) => {
        const speaker =
          paragraph.speaker !== undefined && paragraph.speaker !== null
            ? `Speaker ${paragraph.speaker}`
            : "Speaker";
        const text = Array.isArray(paragraph.sentences)
          ? paragraph.sentences.map((sentence) => sentence.text).join(" ")
          : "";
        return text.trim() ? `${speaker}: ${text.trim()}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return alternative.transcript || "";
}

async function transcribeWithDeepgram({
  file,
  speakerLabels,
  language,
  dictionaryKeywords = [],
  transcriptionSettings = {},
}) {
  if (typeof fetch !== "function") {
    throw createHttpError(503, "Deepgram provider cần Node.js 18+ để dùng fetch.");
  }

  const params = new URLSearchParams({
    model: getDeepgramModel(),
    smart_format: process.env.DEEPGRAM_SMART_FORMAT || "true",
    punctuate: process.env.DEEPGRAM_PUNCTUATE || "true",
    paragraphs: process.env.DEEPGRAM_PARAGRAPHS || "true",
    utterances: process.env.DEEPGRAM_UTTERANCES || "true",
  });

  const requestedLanguage = getDeepgramLanguage(language);
  if (
    requestedLanguage === "auto" ||
    process.env.DEEPGRAM_DETECT_LANGUAGE === "true"
  ) {
    params.set("detect_language", "true");
  } else {
    params.set("language", requestedLanguage);
  }
  if (speakerLabels) {
    if (process.env.DEEPGRAM_DIARIZE_MODEL) {
      params.set("diarize_model", process.env.DEEPGRAM_DIARIZE_MODEL);
    } else {
      params.set("diarize", "true");
    }
  }
  if (transcriptionSettings.fillerWords === "yes") {
    params.set("filler_words", "true");
  }
  if (transcriptionSettings.profanityFilter === "yes") {
    params.set("profanity_filter", "true");
  }
  for (const keyword of dictionaryKeywords) {
    const clean = String(keyword || "").trim();
    if (clean) params.append("keyterm", clean);
  }
  if (process.env.DEEPGRAM_KEYWORDS) {
    for (const keyword of process.env.DEEPGRAM_KEYWORDS.split(",")) {
      const clean = keyword.trim();
      if (clean) params.append("keywords", clean);
    }
  }

  const response = await fetch(`${DEEPGRAM_API_BASE_URL}/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${getDeepgramApiKey()}`,
      "Content-Type": file.mimetype || "application/octet-stream",
    },
    body: file.buffer,
  });
  const body = await readResponseBody(response);
  const metadata = body?.metadata || {};

  return {
    provider: "deepgram",
    providerId: metadata.request_id || null,
    duration: metadata.duration || null,
    detectedLanguage:
      body?.results?.channels?.[0]?.detected_language ||
      body?.results?.channels?.[0]?.alternatives?.[0]?.languages?.[0] ||
      null,
    text: buildTextFromDeepgram(body, speakerLabels),
    words: normalizeDeepgramWords(body),
  };
}

function getSonixLanguage() {
  return (process.env.SONIX_LANGUAGE || "vi").trim();
}

async function submitSonixMedia(file, filename, language, dictionaryKeywords = []) {
  if (file.size > SONIX_DIRECT_UPLOAD_MAX_MB * 1024 * 1024) {
    throw createHttpError(
      400,
      `Sonix API chỉ hỗ trợ upload trực tiếp tối đa ${SONIX_DIRECT_UPLOAD_MAX_MB}MB. Hãy dùng file nhỏ hơn hoặc triển khai file_url cho file lớn.`,
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([file.buffer], {
      type: file.mimetype || "application/octet-stream",
    }),
    filename,
  );
  form.append("language", normalizeLanguageCode(language, getSonixLanguage()));
  form.append("name", filename);

  const keywords = [
    ...dictionaryKeywords.map((keyword) => String(keyword || "").trim()),
    ...(process.env.SONIX_KEYWORDS || "")
      .split(",")
      .map((keyword) => keyword.trim()),
  ].filter(Boolean);
  if (keywords.length > 0) form.append("keywords", keywords.join(","));
  if (process.env.SONIX_FOLDER_ID)
    form.append("folder_id", process.env.SONIX_FOLDER_ID);
  if (process.env.SONIX_CALLBACK_URL)
    form.append("callback_url", process.env.SONIX_CALLBACK_URL);

  return sonixRequest("/media", {
    method: "POST",
    body: form,
  });
}

async function waitForSonixCompletion(mediaId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SONIX_TIMEOUT_MS) {
    const media = await sonixRequest(`/media/${encodeURIComponent(mediaId)}`, {
      method: "GET",
    });

    if (media.status === "completed") return media;
    if (["failed", "blocked"].includes(media.status)) {
      throw createHttpError(
        500,
        `Sonix xử lý thất bại với trạng thái: ${media.status}`,
      );
    }

    await delay(SONIX_POLL_INTERVAL_MS);
  }

  throw createHttpError(
    504,
    "Sonix xử lý quá lâu. Vui lòng thử lại sau hoặc tăng SONIX_TIMEOUT_MS.",
  );
}

function normalizeSonixWords(jsonTranscript) {
  const segments = Array.isArray(jsonTranscript?.transcript)
    ? jsonTranscript.transcript
    : [];

  return segments.flatMap((segment) => {
    const speaker = segment.speaker || null;
    const words = Array.isArray(segment.words) ? segment.words : [];
    return words.map((word) => ({
      text: word.text || "",
      start: Math.round(Number(word.start_time || 0) * 1000),
      end: Math.round(Number(word.end_time || word.start_time || 0) * 1000),
      speaker,
    }));
  });
}

function buildTextFromSonixJson(jsonTranscript, speakerLabels) {
  const segments = Array.isArray(jsonTranscript?.transcript)
    ? jsonTranscript.transcript
    : [];

  return segments
    .map((segment) => {
      const text = (segment.words || [])
        .map((word) => word.text)
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!text) return "";
      if (speakerLabels && segment.speaker)
        return `${segment.speaker}: ${text}`;
      return text;
    })
    .filter(Boolean)
    .join(speakerLabels ? "\n\n" : " ")
    .trim();
}

async function transcribeWithSonix({
  file,
  speakerLabels,
  filename,
  language,
  dictionaryKeywords = [],
}) {
  const uploadResult = await submitSonixMedia(
    file,
    filename,
    language,
    dictionaryKeywords,
  );
  const mediaId = uploadResult.duplicate_media_id || uploadResult.id;

  if (!mediaId) {
    throw createHttpError(500, "Sonix không trả về media id sau khi upload.");
  }

  const media = await waitForSonixCompletion(mediaId);
  const jsonTranscript = await sonixRequest(
    `/media/${encodeURIComponent(mediaId)}/transcript.json`,
    {
      method: "GET",
    },
  );

  const words = normalizeSonixWords(jsonTranscript);
  const text = buildTextFromSonixJson(jsonTranscript, speakerLabels);

  return {
    provider: "sonix",
    providerId: mediaId,
    duration: media.duration || null,
    text,
    words,
  };
}

async function transcribeWithAssemblyAI({ file, speakerLabels }) {
  const client = getAssemblyClient();
  const transcript = await client.transcripts.transcribe({
    audio: file.buffer,
    language_detection: true,
    speaker_labels: Boolean(speakerLabels),
  });

  if (transcript.status === "error") {
    throw createHttpError(
      500,
      transcript.error || "Dịch vụ chuyển âm thanh thành văn bản trả về lỗi",
    );
  }

  const text =
    Boolean(speakerLabels) && transcript.utterances?.length > 0
      ? transcript.utterances
          .map((u) => `Người nói ${u.speaker}: ${u.text}`)
          .join("\n\n")
      : transcript.text || "";

  return {
    provider: "assemblyai",
    providerId: transcript.id || null,
    duration: transcript.audio_duration || null,
    text,
    words: transcript.words || [],
  };
}

async function transcribeAudio({
  file,
  speakerLabels,
  filename,
  language,
  audioMode = "speech",
  dictionaryKeywords = [],
  transcriptionSettings = {},
}) {
  const provider = getTranscriptionProvider();
  assertSupportedProvider(provider);
  const normalizedAudioMode = normalizeAudioMode(audioMode);
  const preprocessing =
    normalizedAudioMode === "song"
      ? await prepareMusicAudioForStt(file, filename)
      : { file, applied: false, warning: null };
  const providerFile = preprocessing.file;

  if (provider === "sonix") {
    const result = await transcribeWithSonix({
      file: providerFile,
      speakerLabels,
      filename: providerFile.originalname || filename,
      language,
      dictionaryKeywords,
    });
    return {
      ...result,
      audioMode: normalizedAudioMode,
      preprocessingApplied: preprocessing.applied,
      preprocessingWarning: preprocessing.warning,
    };
  }
  if (provider === "deepgram") {
    const result = await transcribeWithDeepgram({
      file: providerFile,
      speakerLabels,
      filename: providerFile.originalname || filename,
      language,
      dictionaryKeywords,
      transcriptionSettings,
    });
    return {
      ...result,
      audioMode: normalizedAudioMode,
      preprocessingApplied: preprocessing.applied,
      preprocessingWarning: preprocessing.warning,
    };
  }

  const result = await transcribeWithAssemblyAI({ file: providerFile, speakerLabels });
  return {
    ...result,
    audioMode: normalizedAudioMode,
    preprocessingApplied: preprocessing.applied,
    preprocessingWarning: preprocessing.warning,
  };
}

async function transcribeAndSave({
  userId,
  file,
  speakerLabels = false,
  source = "upload",
  language = "auto",
  audioMode = "speech",
  translateTo = "",
  dictionaryKeywords = [],
  transcriptionSettings = {},
  validateResult,
}) {
  if (!file) throw createHttpError(400, "Vui lòng chọn file âm thanh");
  if (!ALLOWED_EXT.test(file.originalname || "")) {
    throw createHttpError(400, "Định dạng file không được hỗ trợ");
  }

  let savedAudioFilename = null;

  try {
    const filename = normalizeFilename(file.originalname);
    const startedAt = Date.now();
    const sourceLanguage = normalizeLanguageCode(language, "auto");
    const targetLanguage = normalizeTranslateTarget(translateTo);
    const result = await transcribeAudio({
      file,
      speakerLabels,
      filename,
      language: sourceLanguage,
      audioMode,
      dictionaryKeywords,
      transcriptionSettings,
    });
    const processingSeconds = Number(
      ((Date.now() - startedAt) / 1000).toFixed(2),
    );

    if (!String(result.text || "").trim()) {
      const isSongMode = normalizeAudioMode(audioMode) === "song";
      throw createHttpError(
        422,
        isSongMode
          ? "Chế độ bài hát đã thử làm rõ vocal nhưng vẫn chưa phát hiện đủ lời để xuất văn bản. Hãy thử file có vocal rõ hơn, bản karaoke/acapella, hoặc nối thêm model tách vocal AI như Demucs."
          : "Không phát hiện lời nói rõ để xuất thành văn bản. Nếu đây là file nhạc MP3, hãy bật chế độ Bài hát/nhạc nền rồi thử lại.",
      );
    }

    if (validateResult) {
      await validateResult({
        duration: result.duration,
        processingSeconds,
        provider: result.provider,
        source,
      });
    }

    let translation = null;
    let translationError = null;
    if (targetLanguage) {
      try {
        translation = await translateTranscript({
          text: result.text,
          sourceLanguage: result.detectedLanguage || sourceLanguage,
          targetLanguage,
        });
      } catch (error) {
        translationError =
          error.message || "Không dịch được transcript sang ngôn ngữ đã chọn.";
      }
    }

    const ext = getSafeExtension(file.originalname);
    savedAudioFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, savedAudioFilename), file.buffer);

    const { rows } = await pool.query(
      `INSERT INTO transcriptions (
         user_id, filename, file_size, duration, processing_seconds, text, words, audio_filename,
         source_language, translated_text, translation_target_language, translation_provider
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, filename, file_size, duration, processing_seconds, text, words, audio_filename,
         source_language, translated_text, translation_target_language, translation_provider, created_at`,
      [
        userId,
        filename,
        file.size,
        result.duration,
        processingSeconds,
        result.text,
        JSON.stringify(result.words || []),
        savedAudioFilename,
        result.detectedLanguage || sourceLanguage,
        translation?.text || null,
        translation?.targetLanguage || targetLanguage || null,
        translation?.provider || null,
      ],
    );

    return {
      id: rows[0].id,
      provider: result.provider,
      providerId: result.providerId,
      audioMode: result.audioMode,
      preprocessingApplied: result.preprocessingApplied,
      preprocessingWarning: result.preprocessingWarning,
      filename: rows[0].filename,
      fileSize: rows[0].file_size,
      duration: rows[0].duration,
      processingSeconds: rows[0].processing_seconds,
      text: rows[0].text,
      words: rows[0].words || [],
      sourceLanguage: rows[0].source_language,
      translation: rows[0].translated_text
        ? {
            text: rows[0].translated_text,
            sourceLanguage: rows[0].source_language,
            targetLanguage: rows[0].translation_target_language,
            provider: rows[0].translation_provider,
          }
        : null,
      translationError,
      createdAt: rows[0].created_at,
    };
  } catch (error) {
    if (savedAudioFilename)
      fs.unlink(path.join(UPLOADS_DIR, savedAudioFilename), () => {});
    throw error;
  }
}

module.exports = {
  ALLOWED_EXT,
  MAX_SIZE_MB,
  UPLOADS_DIR,
  createHttpError,
  getTranscriptionProvider,
  transcribeAndSave,
};
