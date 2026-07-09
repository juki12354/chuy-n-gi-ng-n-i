-- Migration: lưu ngôn ngữ nguồn và bản dịch transcript

ALTER TABLE transcriptions
  ADD COLUMN IF NOT EXISTS source_language VARCHAR(20),
  ADD COLUMN IF NOT EXISTS translated_text TEXT,
  ADD COLUMN IF NOT EXISTS translation_target_language VARCHAR(20),
  ADD COLUMN IF NOT EXISTS translation_provider VARCHAR(40);
