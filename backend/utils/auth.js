const crypto = require('crypto');

const ROLE_LABELS = {
  system_admin: '系统管理员',
  developer: '开发管理员',
  data_admin: '数据管理员',
  normal_user: '普通用户'
};

const sessions = new Map();

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    role: user.role,
    role_label: ROLE_LABELS[user.role] || user.role,
    display_name: user.display_name || user.username,
    unqualified_dimension_preset_name: user.unqualified_dimension_preset_name || ''
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$${salt}$${hash}`;
}

function verifyPassword(password, storedPassword) {
  const stored = String(storedPassword || '');
  const parts = stored.split('$');
  if (parts.length === 3 && parts[0] === 'pbkdf2_sha256') {
    const calculated = hashPassword(password, parts[1]);
    if (calculated.length !== stored.length) return false;
    return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(stored));
  }
  return stored === String(password || '');
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const safeUser = sanitizeUser(user);
  sessions.set(token, { ...safeUser, token, login_at: new Date().toISOString() });
  return { token, user: safeUser };
}

async function login(pool, username, password) {
  const [rows] = await pool.query(
    'SELECT id, username, password, role, display_name, email, status, unqualified_dimension_preset_name FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  const user = rows[0];
  if (!user || user.status === 'disabled' || !verifyPassword(password, user.password)) {
    return null;
  }

  if (!String(user.password || '').startsWith('pbkdf2_sha256$')) {
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashPassword(password), user.id]);
  }
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  return createSession(user);
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

function getSessionUser(req) {
  const token = getTokenFromRequest(req);
  return token ? sessions.get(token) : null;
}

function authenticate(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    // SPA 前端应在 axios 拦截器中对 401 提示后跳转 /login（见 frontend/src/utils/request.js）
    return res.status(401).json({ success: false, message: '请先登录' });
  }
  req.user = user;
  next();
}

function requireRoles(roles = []) {
  return (req, res, next) => {
    authenticate(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: '当前账号无操作权限' });
      }
      next();
    });
  };
}

function logout(req) {
  const token = getTokenFromRequest(req);
  if (token) sessions.delete(token);
}

async function refreshSessionUser(pool, token) {
  const existing = sessions.get(token);
  if (!existing?.id) {
    return null;
  }

  const [rows] = await pool.query(
    'SELECT id, username, password, role, display_name, email, status, unqualified_dimension_preset_name FROM users WHERE id = ? LIMIT 1',
    [existing.id]
  );
  const user = rows[0];
  if (!user || user.status === 'disabled') {
    sessions.delete(token);
    return null;
  }

  const safeUser = sanitizeUser(user);
  const nextSession = {
    token,
    login_at: existing.login_at,
    ...safeUser
  };

  sessions.set(token, nextSession);
  return nextSession;
}

module.exports = {
  ROLE_LABELS,
  authenticate,
  createSession,
  getSessionUser,
  hashPassword,
  login,
  logout,
  requireRoles,
  sanitizeUser,
  verifyPassword,
  refreshSessionUser
};
