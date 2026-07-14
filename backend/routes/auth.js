require('dotenv').config();
const express = require('express');
const passport = require('passport');
const passportConfig = require('../config/passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { confirmUsageAlertToken } = require('../services/quotaService');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const USAGE_ALERT_REDIRECT_PATH =
  process.env.USAGE_ALERT_REDIRECT_PATH || '/upload';

function getUsageAlertRedirectUrl(status) {
  const baseUrl = FRONTEND_URL.replace(/\/$/, '');
  const path = USAGE_ALERT_REDIRECT_PATH.startsWith('/')
    ? USAGE_ALERT_REDIRECT_PATH
    : `/${USAGE_ALERT_REDIRECT_PATH}`;
  const separator = path.includes('?') ? '&' : '?';
  return `${baseUrl}${path}${separator}usageAlert=${encodeURIComponent(status)}`;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function normalizePlan(plan) {
  const clean = String(plan || '').trim().toLowerCase();
  if (clean === 'premium' || clean === 'pro' || clean === 'special')
    return 'special';
  if (clean === 'basic' || clean === 'standard') return 'standard';
  if (clean === 'business' || clean === 'enterprise') return 'business';
  return 'free';
}

function normalizeUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    avatar: row.avatar ?? null,
    plan: normalizePlan(row.plan),
  };
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice('Bearer '.length).trim();
}

async function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, first_name, last_name, email, avatar, plan FROM users WHERE id = $1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
    }

    req.authToken = token;
    req.user = rows[0];
    return next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// GET /api/auth/google — khởi tạo OAuth với Google
router.get('/google', (req, res, next) => {
  if (!passportConfig.hasGoogleOAuth) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

// GET /api/auth/google/callback — Google gọi về sau khi user đăng nhập
router.get(
  '/google/callback',
  (req, res, next) => {
    if (!passportConfig.hasGoogleOAuth) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
    }

    return passport.authenticate('google', {
      session: false,
      failureRedirect: `${FRONTEND_URL}/login?error=google_failed`,
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const { googleId, email, firstName, lastName } = req.user;

      // Kiểm tra user đã tồn tại chưa
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE google_id = $1',
        [googleId]
      );

      if (rows.length > 0) {
        // User đã có tài khoản → tạo token, redirect về trang upload
        const token = generateToken(rows[0]);
        return res.redirect(`${FRONTEND_URL}/upload?token=${token}`);
      }

      // User mới → redirect về trang đăng ký với thông tin Google
      // Dùng URL-safe base64: thay +→- /→_ bỏ = để tránh bị URLSearchParams decode sai
      const googleData = Buffer.from(
        JSON.stringify({ googleId, email, firstName, lastName })
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return res.redirect(`${FRONTEND_URL}/register?data=${googleData}`);
    } catch (error) {
      console.error('Google callback error:', error);
      return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
);

// POST /api/auth/register — đăng ký tài khoản mới bằng email/password
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, googleId } = req.body;
    const cleanFirstName = String(firstName || '').trim();
    const cleanLastName = String(lastName || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email này đã được đăng ký' });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password, google_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, email, avatar, plan`,
      [cleanFirstName, cleanLastName, cleanEmail, hashedPassword, googleId || null]
    );

    const user = rows[0];
    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: normalizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// POST /api/auth/login — đăng nhập bằng email/password
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
    }

    const { rows } = await pool.query(
      'SELECT id, first_name, last_name, email, password, avatar, plan FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (rows.length === 0 || !rows[0].password) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const matched = await bcrypt.compare(password, rows[0].password);
    if (!matched) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const user = rows[0];
    const token = generateToken(user);

    return res.json({
      token,
      user: normalizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// GET /api/auth/me — lấy thông tin user hiện tại qua JWT
router.get('/me', requireAuth, (req, res) => {
  return res.json(normalizeUser(req.user));
});

// POST /api/auth/logout — V1 dùng JWT stateless, frontend xóa token là đủ
router.post('/logout', requireAuth, (_req, res) => {
  return res.json({ success: true });
});

// GET /api/auth/usage-alert/confirm - xac nhan tiep tuc sau nguong dung hang ngay
router.get('/usage-alert/confirm', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.redirect(getUsageAlertRedirectUrl('missing_token'));
    }

    const confirmed = await confirmUsageAlertToken(token);
    if (!confirmed) {
      return res.redirect(getUsageAlertRedirectUrl('invalid_token'));
    }

    return res.redirect(getUsageAlertRedirectUrl('confirmed'));
  } catch (error) {
    console.error('Confirm usage alert error:', error);
    return res.redirect(getUsageAlertRedirectUrl('server_error'));
  }
});

// PATCH /api/auth/profile — cập nhật họ tên
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ và tên' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET first_name = $1, last_name = $2
       WHERE id = $3
       RETURNING id, first_name, last_name, email, avatar, plan`,
      [firstName.trim(), lastName.trim(), req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    return res.json(normalizeUser(rows[0]));
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Không cập nhật được thông tin' });
  }
});

// POST /api/auth/avatar — cập nhật ảnh đại diện (base64 data URL)
router.post('/avatar', requireAuth, async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar || !avatar.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Ảnh không hợp lệ' });
    }

    // Giới hạn kích thước ~2MB base64
    if (avatar.length > 2 * 1024 * 1024 * 1.37) {
      return res.status(400).json({ error: 'Ảnh quá lớn (tối đa 2MB)' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET avatar = $1
       WHERE id = $2
       RETURNING id, first_name, last_name, email, avatar, plan`,
      [avatar, req.user.id]
    );

    return res.json(normalizeUser(rows[0]));
  } catch (error) {
    console.error('Update avatar error:', error);
    return res.status(500).json({ error: 'Không cập nhật được ảnh đại diện' });
  }
});

// POST /api/auth/change-password — đổi hoặc thiết lập mật khẩu đăng nhập
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
    }

    const { rows } = await pool.query(
      'SELECT id, password FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const currentHash = rows[0].password;
    if (currentHash) {
      const matched = await bcrypt.compare(currentPassword, currentHash);
      if (!matched) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [
      hashedPassword,
      req.user.id,
    ]);

    return res.json({ message: 'Đã đổi mật khẩu' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Không thể đổi mật khẩu' });
  }
});

module.exports = router;
