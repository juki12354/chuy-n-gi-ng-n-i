require("dotenv").config();
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getUserSettings,
  normalizeDictionaryText,
  saveCustomDictionary,
  saveTranscriptionSettings,
} = require("../services/userSettingsService");

const router = express.Router();

function countDictionaryEntries(text) {
  return normalizeDictionaryText(text).split("\n").filter(Boolean).length;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.id);
    return res.json({
      ...settings,
      entriesCount: countDictionaryEntries(settings.customDictionary),
    });
  } catch (error) {
    console.error("Settings load error:", error);
    return res.status(500).json({ error: "Không tải được cài đặt" });
  }
});

router.patch("/dictionary", requireAuth, async (req, res) => {
  try {
    const dictionaryText =
      req.body.customDictionary ?? req.body.dictionaryText ?? "";
    const settings = await saveCustomDictionary(req.user.id, dictionaryText);
    return res.json({
      ...settings,
      entriesCount: countDictionaryEntries(settings.customDictionary),
    });
  } catch (error) {
    console.error("Dictionary save error:", error);
    return res.status(500).json({ error: "Không lưu được custom dictionary" });
  }
});

router.patch("/transcription", requireAuth, async (req, res) => {
  try {
    const transcriptionSettings =
      req.body.transcriptionSettings ?? req.body.settings ?? {};
    const settings = await saveTranscriptionSettings(
      req.user.id,
      transcriptionSettings,
    );
    return res.json({
      ...settings,
      entriesCount: countDictionaryEntries(settings.customDictionary),
    });
  } catch (error) {
    console.error("Transcription settings save error:", error);
    return res
      .status(500)
      .json({ error: "Không lưu được transcription settings" });
  }
});

module.exports = router;
