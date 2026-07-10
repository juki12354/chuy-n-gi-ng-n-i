require("dotenv").config();
const express = require("express");
const multer = require("multer");
const pool = require("../db");
const { hashApiKey } = require("./apiKeys");
const {
  ALLOWED_EXT,
  MAX_SIZE_MB,
  getTranscriptionProvider,
  transcribeAndSave,
} = require("../services/transcriptionService");
const {
  getQuotaStatus,
  validateBeforeTranscription,
  validateAfterTranscription,
} = require("../services/quotaService");
const {
  getUserSettings,
  parseDictionaryKeywords,
} = require("../services/userSettingsService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXT.test(file.originalname || "")) return cb(null, true);
    return cb(new Error("Định dạng file không được hỗ trợ"));
  },
});

function getApiKeyFromRequest(req) {
  const directKey = req.header("x-api-key");
  if (directKey) return directKey.trim();

  const auth = req.header("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  return "";
}

async function apiKeyAuth(req, res, next) {
  const apiKey = getApiKeyFromRequest(req);
  if (!apiKey)
    return res
      .status(401)
      .json({
        error:
          "Thiếu API key. Dùng header x-api-key hoặc Authorization: Bearer <api_key>.",
      });
  if (!apiKey.startsWith("vbee_sk_"))
    return res.status(401).json({ error: "API key không hợp lệ" });

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, name
       FROM api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [hashApiKey(apiKey)],
    );

    if (rows.length === 0)
      return res
        .status(401)
        .json({ error: "API key không hợp lệ hoặc đã bị thu hồi" });

    await pool.query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [
      rows[0].id,
    ]);
    req.apiKey = rows[0];
    req.user = { id: rows[0].user_id };
    return next();
  } catch (error) {
    console.error("API key auth error:", error);
    return res.status(500).json({ error: "Không thể xác thực API key" });
  }
}

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Vbee API",
    version: "v1",
    transcriptionProvider: getTranscriptionProvider(),
  });
});

router.post(
  "/transcribe",
  apiKeyAuth,
  (req, res, next) => {
    upload.single("audio")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: `File quá lớn (tối đa ${MAX_SIZE_MB}MB)` });
      }
      if (err) return res.status(400).json({ error: err.message });
      return next();
    });
  },
  async (req, res) => {
    try {
      const source = req.body.source === "recording" ? "recording" : "api";
      const expectedDurationSeconds = req.body.expectedDuration
        ? Number(req.body.expectedDuration)
        : null;
      const language =
        req.body.language || req.body.transcriptionLanguage || "auto";
      const audioMode =
        req.body.audioMode === "song" || req.body.audioMode === "music"
          ? "song"
          : "speech";
      const translateTo =
        req.body.translateTo || req.body.targetLanguage || "";
      const userSettings = await getUserSettings(req.user.id);
      const dictionaryKeywords = parseDictionaryKeywords(
        userSettings.customDictionary,
      );

      await validateBeforeTranscription({
        userId: req.user.id,
        file: req.file,
        source,
        expectedDurationSeconds,
      });

      const result = await transcribeAndSave({
        userId: req.user.id,
        file: req.file,
        source,
        language,
        audioMode,
        translateTo,
        dictionaryKeywords,
        transcriptionSettings: userSettings.transcriptionSettings,
        speakerLabels:
          req.body.speakerLabels === "true" || req.body.speakerLabels === true,
        validateResult: ({ duration }) =>
          validateAfterTranscription({
            userId: req.user.id,
            durationSeconds: duration,
            source,
          }),
      });
      const quota = await getQuotaStatus(req.user.id);

      return res.json({
        id: result.id,
        object: "transcription",
        provider: result.provider,
        providerId: result.providerId,
        audioMode: result.audioMode,
        preprocessingApplied: result.preprocessingApplied,
        preprocessingMethod: result.preprocessingMethod,
        preprocessingWarning: result.preprocessingWarning,
        filename: result.filename,
        duration: result.duration,
        processingSeconds: result.processingSeconds,
        text: result.text,
        sourceLanguage: result.sourceLanguage,
        translation: result.translation,
        translationError: result.translationError,
        words: result.words,
        createdAt: result.createdAt,
        quota,
      });
    } catch (error) {
      console.error("Public API transcribe error:", error);
      return res
        .status(error.statusCode || 500)
        .json({
          error: error.message || "Lỗi khi xử lý API",
          quota: error.details?.quota,
        });
    }
  },
);

module.exports = router;
