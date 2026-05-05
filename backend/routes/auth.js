const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, hashPassword, login, logout, verifyPassword } = require('../utils/auth');

// Demo accounts shown on the login page. Repair legacy rows without overwriting changed pbkdf2 passwords.
const SEED_ACCOUNTS = [
  { username: 'admin', password: 'admin', role: 'developer', displayName: '系统管理员' },
  { username: 'data_admin', password: 'data_admin', role: 'data_admin', displayName: '数据管理员' },
  { username: 'user', password: 'user', role: 'normal_user', displayName: '普通用户' }
];

async function reconcileSeedAccounts() {
  for (const seed of SEED_ACCOUNTS) {
    const [rows] = await pool.query('SELECT id, password FROM users WHERE username = ? LIMIT 1', [seed.username]);
    const row = rows[0];
    if (!row) continue;

    const storedPassword = String(row.password || '');
    if (verifyPassword(seed.password, storedPassword)) {
      await pool.query('UPDATE users SET role = ?, status = ? WHERE id = ?', [seed.role, 'active', row.id]);
      continue;
    }

    if (storedPassword.startsWith('pbkdf2_sha256$')) continue;

    await pool.query(
      'UPDATE users SET password = ?, role = ?, status = ?, display_name = COALESCE(NULLIF(display_name, \'\'), ?) WHERE id = ?',
      [hashPassword(seed.password), seed.role, 'active', seed.displayName, row.id]
    );
  }
}

async function ensureUserSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) UNIQUE,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      role ENUM('developer', 'data_admin', 'normal_user') DEFAULT 'normal_user',
      status ENUM('active', 'disabled') DEFAULT 'active',
      last_login_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const addColumn = async (sql) => {
    try {
      await pool.query(sql);
    } catch (error) {
      if (!['ER_DUP_FIELDNAME'].includes(error.code)) throw error;
    }
  };

  await addColumn('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) AFTER password');
  await addColumn("ALTER TABLE users ADD COLUMN status ENUM('active', 'disabled') DEFAULT 'active' AFTER role");
  await addColumn('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL AFTER status');
  await pool.query('ALTER TABLE users MODIFY email VARCHAR(100) NULL');
  await pool.query("ALTER TABLE users MODIFY role ENUM('admin', 'editor', 'viewer', 'developer', 'data_admin', 'normal_user') DEFAULT 'normal_user'");
  await pool.query("UPDATE users SET role = 'developer' WHERE role = 'admin'");
  await pool.query("UPDATE users SET role = 'data_admin' WHERE role = 'editor'");
  await pool.query("UPDATE users SET role = 'normal_user' WHERE role = 'viewer'");
  await pool.query("ALTER TABLE users MODIFY role ENUM('developer', 'data_admin', 'normal_user') DEFAULT 'normal_user'");
  await pool.query(
    `INSERT IGNORE INTO users (username, email, password, display_name, role, status)
     VALUES (?, ?, ?, ?, 'developer', 'active'),
            (?, ?, ?, ?, 'data_admin', 'active'),
            (?, ?, ?, ?, 'normal_user', 'active')`,
    [
      'admin', 'admin@cosmetics.com', hashPassword('admin'), '系统管理员',
      'data_admin', 'data_admin@cosmetics.com', hashPassword('data_admin'), '数据管理员',
      'user', 'user@cosmetics.com', hashPassword('user'), '普通用户'
    ]
  );

  await reconcileSeedAccounts();
}

function parseDetails(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { text: String(raw) };
  }
}

function toLogRow(row) {
  const details = parseDetails(row.details);
  return {
    id: row.id,
    action: row.action,
    module: row.module,
    record_id: row.record_id,
    created_at: row.created_at,
    username: row.username || details.username || '',
    role: row.role || details.role || '',
    role_label: details.role_label || '',
    dimension_label: details.dimension_label || '',
    dimension_order: details.dimension_order || [],
    range_label: details.range_label || '',
    detail_count: details.detail_count || 0,
    details
  };
}

router.post('/login', async (req, res) => {
  try {
    await ensureUserSchema();
    const { username, password } = req.body || {};
    const result = await login(pool, String(username || '').trim(), String(password || ''));
    if (!result) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

router.post('/register', async (req, res) => {
  try {
    await ensureUserSchema();
    const { username, password, display_name, email } = req.body || {};
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '');
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalizedUsername)) {
      return res.status(400).json({ success: false, message: '账号需为 3-30 位字母、数字或下划线' });
    }
    if (normalizedPassword.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少 6 位' });
    }

    await pool.query(
      `INSERT INTO users (username, email, password, display_name, role, status)
       VALUES (?, ?, ?, ?, 'normal_user', 'active')`,
      [
        normalizedUsername,
        String(email || '').trim() || null,
        hashPassword(normalizedPassword),
        String(display_name || '').trim() || normalizedUsername
      ]
    );

    res.json({ success: true, message: '普通用户注册成功' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '账号或邮箱已存在' });
    }
    console.error('注册普通用户失败:', error);
    res.status(500).json({ success: false, message: '注册普通用户失败' });
  }
});

router.post('/logout', authenticate, (req, res) => {
  logout(req);
  res.json({ success: true, message: '已退出登录' });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

router.put('/me/password', authenticate, async (req, res) => {
  try {
    await ensureUserSchema();
    const { current_password, new_password } = req.body || {};
    if (String(new_password || '').length < 6) {
      return res.status(400).json({ success: false, message: '新密码至少 6 位' });
    }

    const [rows] = await pool.query('SELECT id, password FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user || !verifyPassword(current_password, user.password)) {
      return res.status(400).json({ success: false, message: '当前密码不正确' });
    }

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashPassword(new_password), req.user.id]);
    res.json({ success: true, message: '密码已更新' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ success: false, message: '修改密码失败' });
  }
});

router.get('/operation-logs', authenticate, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);

    const [rows] = await pool.query(
      `SELECT l.id, l.action, l.module, l.record_id, l.details, l.created_at, u.username, u.role
       FROM operation_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.module = 'unqualified_products' AND l.action = 'generate_video_copy'
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    const logs = rows.map(toLogRow);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ success: false, message: '获取操作日志失败' });
  }
});

router.post('/operation-logs', authenticate, async (req, res) => {
  try {
    const { action, module, record_id, details } = req.body || {};
    const normalizedAction = String(action || '').trim();
    const normalizedModule = String(module || '').trim();
    if (!normalizedAction || !normalizedModule) {
      return res.status(400).json({ success: false, message: '日志 action/module 不能为空' });
    }

    const payload = {
      ...(details && typeof details === 'object' ? details : {}),
      username: req.user.username,
      role: req.user.role,
      role_label: req.user.role_label
    };

    await pool.query(
      'INSERT INTO operation_logs (user_id, action, module, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        normalizedAction,
        normalizedModule,
        record_id || null,
        JSON.stringify(payload),
        req.ip || null
      ]
    );

    res.json({ success: true, message: '日志已记录' });
  } catch (error) {
    console.error('写入操作日志失败:', error);
    res.status(500).json({ success: false, message: '写入操作日志失败' });
  }
});

module.exports = router;
