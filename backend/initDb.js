const bcrypt = require('bcryptjs');
const pool = require('./db');

const FREE_PLAN_SECONDS = Number.parseInt(process.env.FREE_PLAN_SECONDS || `${30 * 60}`, 10);
const DEFAULT_QUOTA_ALERT_SECONDS = Number.parseInt(process.env.DEFAULT_QUOTA_ALERT_SECONDS || `${5 * 60}`, 10);

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id VARCHAR(255) UNIQUE,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255),
      avatar TEXT,
      plan VARCHAR(20) NOT NULL DEFAULT 'free',
      quota_seconds INTEGER NOT NULL DEFAULT ${FREE_PLAN_SECONDS},
      quota_alert_seconds INTEGER NOT NULL DEFAULT ${DEFAULT_QUOTA_ALERT_SECONDS},
      usage_alert_daily_seconds INTEGER NOT NULL DEFAULT 0,
      usage_alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
      usage_alert_required BOOLEAN NOT NULL DEFAULT FALSE,
      usage_alert_token VARCHAR(255),
      usage_alert_sent_at TIMESTAMP WITH TIME ZONE,
      usage_alert_confirmed_at TIMESTAMP WITH TIME ZONE,
      plan_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      plan_expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_seconds INTEGER NOT NULL DEFAULT ${FREE_PLAN_SECONDS};`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_alert_seconds INTEGER NOT NULL DEFAULT ${DEFAULT_QUOTA_ALERT_SECONDS};`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_daily_seconds INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_date DATE NOT NULL DEFAULT CURRENT_DATE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_required BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_token VARCHAR(255);`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_sent_at TIMESTAMP WITH TIME ZONE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_confirmed_at TIMESTAMP WITH TIME ZONE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`
    UPDATE users
    SET usage_alert_daily_seconds = COALESCE(usage_alert_daily_seconds, 0),
        usage_alert_date = COALESCE(usage_alert_date, CURRENT_DATE),
        usage_alert_required = COALESCE(usage_alert_required, FALSE)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      file_size BIGINT,
      duration NUMERIC,
      processing_seconds NUMERIC,
      text TEXT NOT NULL,
      words JSONB DEFAULT '[]'::jsonb,
      segments JSONB DEFAULT '[]'::jsonb,
      speaker_names JSONB DEFAULT '{}'::jsonb,
      audio_filename VARCHAR(255),
      source_language VARCHAR(20),
      translated_text TEXT,
      translation_target_language VARCHAR(20),
      translation_provider VARCHAR(40),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS file_size BIGINT;`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS duration NUMERIC;`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS processing_seconds NUMERIC;`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS words JSONB DEFAULT '[]'::jsonb;`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS segments JSONB DEFAULT '[]'::jsonb;`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS speaker_names JSONB DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS audio_filename VARCHAR(255);`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS source_language VARCHAR(20);`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS translated_text TEXT;`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS translation_target_language VARCHAR(20);`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS translation_provider VARCHAR(40);`);
  await pool.query(`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_transcriptions_user_created ON transcriptions(user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      custom_dictionary TEXT NOT NULL DEFAULT '',
      transcription_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_dictionary TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS transcription_settings JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(80) NOT NULL DEFAULT 'Default API key',
      key_prefix VARCHAR(40) NOT NULL,
      key_hash VARCHAR(64) UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_used_at TIMESTAMP WITH TIME ZONE,
      revoked_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_created ON api_keys(user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_orders (
      id VARCHAR(36) PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(20) NOT NULL,
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
      amount INTEGER NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'VND',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      provider VARCHAR(40) NOT NULL DEFAULT 'demo',
      provider_order_id VARCHAR(120),
      payment_url TEXT,
      raw_request JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      paid_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'standard';`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly';`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'VND';`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS provider VARCHAR(40) NOT NULL DEFAULT 'demo';`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(120);`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS payment_url TEXT;`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS raw_request JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;`);
  await pool.query(`ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_billing_orders_user_created ON billing_orders(user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_billing_orders_status ON billing_orders(status);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(36) NOT NULL REFERENCES billing_orders(id) ON DELETE CASCADE,
      provider VARCHAR(40) NOT NULL,
      provider_transaction_id VARCHAR(120),
      amount INTEGER NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'VND',
      status VARCHAR(20) NOT NULL,
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(40) NOT NULL DEFAULT 'demo';`);
  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(120);`);
  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'VND';`);
  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'paid';`);
  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email VARCHAR(255),
      name VARCHAR(255),
      subject VARCHAR(200) NOT NULL,
      category VARCHAR(60) NOT NULL DEFAULT 'general',
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      page_url TEXT,
      user_plan VARCHAR(20),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      resolved_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS email VARCHAR(255);`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS subject VARCHAR(200) NOT NULL DEFAULT 'Yêu cầu hỗ trợ Vbee';`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'general';`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal';`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open';`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS page_url TEXT;`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_plan VARCHAR(20);`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_user_updated ON support_tickets(user_id, updated_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender VARCHAR(20) NOT NULL DEFAULT 'user',
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender VARCHAR(20) NOT NULL DEFAULT 'user';`);
  await pool.query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages(ticket_id, created_at DESC);`);

  const demoPassword = await bcrypt.hash('123456', 10);
  await pool.query(
    `INSERT INTO users (first_name, last_name, email, password)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    ['Demo', 'User', 'demo@vbee.local', demoPassword]
  );

  console.log('Đã kiểm tra/tạo bảng PostgreSQL thành công');
}

module.exports = initDatabase;
