-- Tạo database nếu chưa có:
-- CREATE DATABASE golden_voice;
-- Sau đó kết nối vào database:
-- \c golden_voice

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  google_id   VARCHAR(255) UNIQUE,
  first_name  VARCHAR(255) NOT NULL,
  last_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255),
  avatar      TEXT,
  plan        VARCHAR(20) NOT NULL DEFAULT 'free',
  quota_seconds INTEGER NOT NULL DEFAULT 1800,
  quota_alert_seconds INTEGER NOT NULL DEFAULT 300,
  plan_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  plan_expires_at TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS transcriptions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename       VARCHAR(255) NOT NULL,
  file_size      BIGINT,
  duration       NUMERIC,
  processing_seconds NUMERIC,
  text           TEXT NOT NULL,
  words          JSONB DEFAULT '[]'::jsonb,
  audio_filename VARCHAR(255),
  source_language VARCHAR(20),
  translated_text TEXT,
  translation_target_language VARCHAR(20),
  translation_provider VARCHAR(40),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcriptions_user_created
ON transcriptions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  custom_dictionary TEXT NOT NULL DEFAULT '',
  transcription_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(80) NOT NULL DEFAULT 'Default API key',
  key_prefix   VARCHAR(40) NOT NULL,
  key_hash     VARCHAR(64) UNIQUE NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at   TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_created
ON api_keys(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
ON api_keys(key_hash);
