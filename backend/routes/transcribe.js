require("dotenv").config();
const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const pool = require("../db");
const {
  ALLOWED_EXT,
  MAX_SIZE_MB,
  UPLOADS_DIR,
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
const {
  normalizeLanguageCode,
  normalizeTranslateTarget,
  translateTranscript,
} = require("../services/translationService");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXT.test(file.originalname)) return cb(null, true);
    cb(new Error("Định dạng file không được hỗ trợ"));
  },
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }
  try {
    req.user = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}

// POST /api/transcribe — nhận file âm thanh, gọi dịch vụ phiên âm, trả về văn bản
router.post(
  "/",
  authMiddleware,
  (req, res, next) => {
    upload.single("audio")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: `File quá lớn (tối đa ${MAX_SIZE_MB}MB)` });
      }
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const source =
        req.body.source === "recording" ||
        req.file?.originalname?.startsWith("recording.")
          ? "recording"
          : "upload";
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
        provider: result.provider,
        providerId: result.providerId,
        audioMode: result.audioMode,
        preprocessingApplied: result.preprocessingApplied,
        preprocessingWarning: result.preprocessingWarning,
        text: result.text,
        sourceLanguage: result.sourceLanguage,
        translation: result.translation,
        translationError: result.translationError,
        duration: result.duration,
        processingSeconds: result.processingSeconds,
        filename: result.filename,
        words: result.words,
        createdAt: result.createdAt,
        quota,
      });
    } catch (err) {
      console.error("Transcribe error:", err);
      return res
        .status(err.statusCode || 500)
        .json({
          error: err.message || "Lỗi khi chuyển đổi âm thanh",
          quota: err.details?.quota,
        });
    }
  },
);

// GET /api/transcribe/history — lịch sử chuyển đổi của user
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, filename, file_size, duration, processing_seconds, text, words, audio_filename,
         source_language, translated_text, translation_target_language, translation_provider, created_at
       FROM transcriptions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id],
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Lỗi server" });
  }
});

// POST /api/transcribe/text — lưu transcript realtime/manual vào lịch sử
router.post("/text", authMiddleware, async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Thiếu nội dung transcript" });
    }

    const durationSeconds = Math.max(
      1,
      Math.ceil(Number(req.body.durationSeconds || req.body.duration || 1)),
    );
    const source = req.body.source === "manual" ? "manual" : "realtime";
    const sourceLanguage = normalizeLanguageCode(req.body.language, "auto");
    const targetLanguage = normalizeTranslateTarget(
      req.body.translateTo || req.body.targetLanguage,
    );
    const filename =
      String(req.body.filename || "").trim() ||
      `${source}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;

    await validateBeforeTranscription({
      userId: req.user.id,
      source,
      expectedDurationSeconds: durationSeconds,
    });

    await validateAfterTranscription({
      userId: req.user.id,
      durationSeconds,
      source,
    });

    let translation = null;
    let translationError = null;
    if (targetLanguage) {
      try {
        translation = await translateTranscript({
          text,
          sourceLanguage,
          targetLanguage,
        });
      } catch (error) {
        translationError =
          error.message || "Không dịch được transcript sang ngôn ngữ đã chọn.";
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO transcriptions (
         user_id, filename, file_size, duration, processing_seconds, text, words, audio_filename,
         source_language, translated_text, translation_target_language, translation_provider
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11)
       RETURNING id, filename, file_size, duration, processing_seconds, text, words, audio_filename,
         source_language, translated_text, translation_target_language, translation_provider, created_at`,
      [
        req.user.id,
        filename,
        0,
        durationSeconds,
        0,
        text,
        JSON.stringify([]),
        translation?.sourceLanguage || sourceLanguage,
        translation?.text || null,
        translation?.targetLanguage || targetLanguage || null,
        translation?.provider || null,
      ],
    );
    const quota = await getQuotaStatus(req.user.id);

    return res.status(201).json({
      id: rows[0].id,
      provider: "browser-realtime",
      providerId: null,
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
      quota,
    });
  } catch (err) {
    console.error("Save realtime transcript error:", err);
    return res.status(err.statusCode || 500).json({
      error: err.message || "Không lưu được transcript realtime",
      quota: err.details?.quota,
    });
  }
});

// GET /api/transcribe/:id/audio — phục vụ file audio (có xác thực)
router.get("/:id/audio", authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });
  try {
    const { rows } = await pool.query(
      "SELECT audio_filename FROM transcriptions WHERE id = $1 AND user_id = $2",
      [id, req.user.id],
    );
    if (!rows[0]?.audio_filename)
      return res.status(404).json({ error: "Không có file audio" });
    const filePath = path.join(UPLOADS_DIR, rows[0].audio_filename);
    if (!fs.existsSync(filePath))
      return res
        .status(404)
        .json({ error: "File audio không tồn tại trên server" });
    res.sendFile(filePath);
  } catch {
    return res.status(500).json({ error: "Lỗi server" });
  }
});

// PATCH /api/transcribe/:id — cập nhật nội dung văn bản
router.patch("/:id", authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });
  const { text } = req.body;
  if (typeof text !== "string")
    return res.status(400).json({ error: "Thiếu trường text" });
  try {
    const { rowCount, rows } = await pool.query(
      "UPDATE transcriptions SET text = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
      [text, id, req.user.id],
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Không tìm thấy bản ghi" });
    return res.json(rows[0]);
  } catch {
    return res.status(500).json({ error: "Lỗi server" });
  }
});

// DELETE /api/transcribe/:id — xóa bản ghi và file audio
router.delete("/:id", authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });
  try {
    // Lấy audio_filename trước khi xóa
    const { rows } = await pool.query(
      "SELECT audio_filename FROM transcriptions WHERE id = $1 AND user_id = $2",
      [id, req.user.id],
    );
    const { rowCount } = await pool.query(
      "DELETE FROM transcriptions WHERE id = $1 AND user_id = $2",
      [id, req.user.id],
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Không tìm thấy bản ghi" });
    // Xóa file audio trên disk
    if (rows[0]?.audio_filename) {
      fs.unlink(path.join(UPLOADS_DIR, rows[0].audio_filename), () => {});
    }
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
