require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey() {
  return `vbee_sk_${crypto.randomBytes(32).toString('base64url')}`;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, key_prefix, created_at, last_used_at
       FROM api_keys
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (error) {
    console.error('List API keys error:', error);
    return res.status(500).json({ error: 'Không thể lấy danh sách API key' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const name = String(req.body.name || 'Default API key').trim().slice(0, 80) || 'Default API key';
    const rawKey = generateApiKey();
    const keyPrefix = `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;
    const keyHash = hashApiKey(rawKey);

    const { rows } = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, key_prefix, created_at, last_used_at`,
      [req.user.id, name, keyPrefix, keyHash]
    );

    return res.status(201).json({ ...rows[0], key: rawKey });
  } catch (error) {
    console.error('Create API key error:', error);
    return res.status(500).json({ error: 'Không thể tạo API key' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

  try {
    const { rowCount } = await pool.query(
      `UPDATE api_keys
       SET revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [id, req.user.id]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Không tìm thấy API key' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return res.status(500).json({ error: 'Không thể thu hồi API key' });
  }
});

module.exports = router;
module.exports.hashApiKey = hashApiKey;
