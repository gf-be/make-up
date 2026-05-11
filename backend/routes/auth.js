const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  authenticate,
  hashPassword,
  login,
  logout,
  verifyPassword,
  requireRoles,
  ROLE_LABELS,
  refreshSessionUser
} = require('../utils/auth');

// Demo accounts shown on the login page. Repair legacy rows without overwriting changed pbkdf2 passwords.
const ALLOWED_MANAGE_ROLES = ['system_admin', 'developer', 'data_admin', 'normal_user'];

const SEED_ACCOUNTS = [
  { username: 'admin', password: 'admin', role: 'system_admin', displayName: '系统管理员' },
  { username: 'developer', password: 'developer', role: 'developer', displayName: '开发管理员' },
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
      role ENUM('system_admin', 'developer', 'data_admin', 'normal_user') DEFAULT 'normal_user',
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
  await addColumn(
    'ALTER TABLE users ADD COLUMN unqualified_dimension_preset_name VARCHAR(200) NULL'
  );
  await pool.query('ALTER TABLE users MODIFY email VARCHAR(100) NULL');

  try {
    await pool.query(
      "ALTER TABLE users MODIFY role ENUM('system_admin', 'developer', 'data_admin', 'normal_user') DEFAULT 'normal_user'"
    );
  } catch (error) {
    try {
      await pool.query(
        "ALTER TABLE users MODIFY role ENUM('admin', 'editor', 'viewer', 'developer', 'data_admin', 'normal_user', 'system_admin') DEFAULT 'normal_user'"
      );
    } catch (_) {
      /* ignore */
    }
    try {
      await pool.query("UPDATE users SET role = 'developer' WHERE role IN ('admin', 'editor', 'viewer')");
    } catch (_) {
      /* ignore */
    }
    await pool.query(
      "ALTER TABLE users MODIFY role ENUM('system_admin', 'developer', 'data_admin', 'normal_user') DEFAULT 'normal_user'"
    );
  }

  await pool.query(
    `INSERT IGNORE INTO users (username, email, password, display_name, role, status)
     VALUES (?, ?, ?, ?, 'system_admin', 'active'),
            (?, ?, ?, ?, 'developer', 'active'),
            (?, ?, ?, ?, 'data_admin', 'active'),
            (?, ?, ?, ?, 'normal_user', 'active')`,
    [
      'admin', 'admin@cosmetics.com', hashPassword('admin'), '系统管理员',
      'developer', 'developer@local', hashPassword('developer'), '开发管理员',
      'data_admin', 'data_admin@cosmetics.com', hashPassword('data_admin'), '数据管理员',
      'user', 'user@cosmetics.com', hashPassword('user'), '普通用户'
    ]
  );

  await reconcileSeedAccounts();

  await ensureUnqualifiedDimensionPresetTables();
}

/** 不合格产品层级方案：标题表 + 用户关联表（同一用户可保存多套方案） */
async function ensureUnqualifiedDimensionPresetTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS unqualified_dimension_preset_titles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      creator_user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      dimension_order_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_udpt_creator (creator_user_id),
      CONSTRAINT fk_udpt_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_unqualified_dimension_preset_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      preset_title_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_u_udpm_user_preset (user_id, preset_title_id),
      INDEX idx_u_udpm_user (user_id),
      CONSTRAINT fk_u_udpm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_u_udpm_preset FOREIGN KEY (preset_title_id) REFERENCES unqualified_dimension_preset_titles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

const UNQUALIFIED_DIMENSION_KEYS = new Set([
  'source',
  'province',
  'manufacturer_province',
  'manufacturer_city',
  'sampled_province',
  'sampled_city',
  'product_category',
  'issue_item',
  'year'
]);

const DEFAULT_UNQUALIFIED_DIMENSION_ORDER = [
  'source',
  'manufacturer_province',
  'manufacturer_city',
  'product_category',
  'issue_item'
];

function normalizeUnqualifiedDimensionOrder(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const unique = [];
  list.forEach((key) => {
    const k = String(key || '').trim();
    if (UNQUALIFIED_DIMENSION_KEYS.has(k) && !unique.includes(k) && unique.length < 5) {
      unique.push(k);
    }
  });
  return unique.length ? unique : [...DEFAULT_UNQUALIFIED_DIMENSION_ORDER];
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

/** 当前用户在关联表中可用的不合格产品层级方案（来自标题表） */
router.get('/me/unqualified-dimension-presets', authenticate, async (req, res) => {
  try {
    await ensureUserSchema();

    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 40, 1), 100);

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.dimension_order_json, m.created_at AS linked_at
       FROM user_unqualified_dimension_preset_members m
       INNER JOIN unqualified_dimension_preset_titles t ON t.id = m.preset_title_id
       WHERE m.user_id = ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );

    const data = rows.map((row) => {
      let order = row.dimension_order_json;
      if (typeof order === 'string') {
        try {
          order = JSON.parse(order);
        } catch {
          order = [];
        }
      }
      return {
        id: row.id,
        title: row.title,
        dimension_order: normalizeUnqualifiedDimensionOrder(order),
        linked_at: row.linked_at
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('获取层级方案列表失败:', error);
    res.status(500).json({ success: false, message: '获取层级方案列表失败' });
  }
});

/** 保存一套层级方案：写入标题表并在关联表中关联当前用户 */
router.post('/me/unqualified-dimension-presets', authenticate, async (req, res) => {
  try {
    await ensureUserSchema();

    const body = req.body || {};
    const title = String(body.title || body.preset_name || '').trim().slice(0, 200);
    if (!title) {
      return res.status(400).json({ success: false, message: '方案名称不能为空' });
    }

    const dimensionOrder = normalizeUnqualifiedDimensionOrder(body.dimension_order);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [insertTitle] = await conn.query(
        'INSERT INTO unqualified_dimension_preset_titles (creator_user_id, title, dimension_order_json) VALUES (?, ?, ?)',
        [req.user.id, title, JSON.stringify(dimensionOrder)]
      );

      const presetTitleId = insertTitle.insertId;

      await conn.query(
        `INSERT INTO user_unqualified_dimension_preset_members (user_id, preset_title_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE created_at = created_at`,
        [req.user.id, presetTitleId]
      );

      await conn.commit();

      res.json({
        success: true,
        message: '方案已保存',
        data: {
          id: presetTitleId,
          title,
          dimension_order: dimensionOrder
        }
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('保存层级方案失败:', error);
    res.status(500).json({ success: false, message: '保存层级方案失败' });
  }
});

/** 移除当前用户与该方案的关联；若无其他用户关联则删除标题记录 */
router.delete('/me/unqualified-dimension-presets/:id', authenticate, async (req, res) => {
  try {
    await ensureUserSchema();

    const presetTitleId = Number.parseInt(req.params.id, 10);
    if (!presetTitleId || presetTitleId < 1) {
      return res.status(400).json({ success: false, message: '无效的方案 id' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [delMember] = await conn.query(
        'DELETE FROM user_unqualified_dimension_preset_members WHERE user_id = ? AND preset_title_id = ?',
        [req.user.id, presetTitleId]
      );

      if (!delMember.affectedRows) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: '方案不存在或无权删除' });
      }

      const [[countRow]] = await conn.query(
        'SELECT COUNT(*) AS c FROM user_unqualified_dimension_preset_members WHERE preset_title_id = ?',
        [presetTitleId]
      );

      if (Number(countRow.c) === 0) {
        await conn.query('DELETE FROM unqualified_dimension_preset_titles WHERE id = ?', [presetTitleId]);
      }

      await conn.commit();
      res.json({ success: true, message: '已删除' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('删除层级方案失败:', error);
    res.status(500).json({ success: false, message: '删除层级方案失败' });
  }
});

router.put('/me', authenticate, async (req, res) => {
  try {
    await ensureUserSchema();
    const body = req.body || {};
    const fields = [];

    const values = [];
    if (Object.prototype.hasOwnProperty.call(body, 'username')) {
      const normalizedUsername = String(body.username || '').trim();
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalizedUsername)) {
        return res.status(400).json({ success: false, message: '账号需为 3-30 位字母、数字或下划线' });
      }
      const [dupName] = await pool.query(
        'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
        [normalizedUsername, req.user.id]
      );
      if (dupName[0]) {
        return res.status(409).json({ success: false, message: '该账号已被使用' });
      }
      fields.push('username = ?');
      values.push(normalizedUsername);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'display_name')) {
      fields.push('display_name = ?');
      const v = body.display_name == null ? null : String(body.display_name).trim().slice(0, 100) || null;
      values.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'email')) {
      fields.push('email = ?');
      const v = body.email == null || body.email === '' ? null : String(body.email).trim().slice(0, 100) || null;
      values.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'unqualified_dimension_preset_name')) {
      fields.push('unqualified_dimension_preset_name = ?');
      const v =
        body.unqualified_dimension_preset_name == null || body.unqualified_dimension_preset_name === ''
          ? null
          : String(body.unqualified_dimension_preset_name).trim().slice(0, 200) || null;
      values.push(v);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const header = req.headers.authorization || '';

    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    const nextUser = token ? await refreshSessionUser(pool, token) : null;


    res.json({ success: true, message: '资料已更新', data: nextUser || req.user });
  } catch (error) {


    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '账号或邮箱与其他用户冲突' });
    }


    console.error('更新个人资料失败:', error);
    res.status(500).json({ success: false, message: '更新个人资料失败' });
  }
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

function toPublicUser(row) {
  const out = {
    id: row.id,
    username: row.username,
    email: row.email || '',
    display_name: row.display_name || '',
    unqualified_dimension_preset_name: row.unqualified_dimension_preset_name || '',
    role: row.role,
    role_label: ROLE_LABELS[row.role] || row.role,
    status: row.status || 'active',
    last_login_at: row.last_login_at,
    created_at: row.created_at
  };
  if (Object.prototype.hasOwnProperty.call(row, 'password')) {
    out.password = row.password == null ? '' : String(row.password);
  }
  return out;
}

async function countActiveRoleExcluding(role, excludeId = 0) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM users WHERE role = ? AND status = ? AND id <> ?',
    [role, 'active', excludeId]
  );
  return Number(rows[0]?.c || 0);
}

router.get('/users', requireRoles(['system_admin']), async (req, res) => {
  try {
    await ensureUserSchema();
    const [rows] = await pool.query(
      `SELECT id, username, email, password, display_name, role, status, last_login_at, created_at,
              unqualified_dimension_preset_name
       FROM users
       ORDER BY id ASC`
    );
    res.json({ success: true, data: rows.map(toPublicUser) });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

router.post('/users', requireRoles(['system_admin']), async (req, res) => {
  try {
    await ensureUserSchema();
    const { username, password, display_name, email, role } = req.body || {};
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '');
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalizedUsername)) {
      return res.status(400).json({ success: false, message: '账号需为 3-30 位字母、数字或下划线' });
    }
    if (normalizedPassword.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少 6 位' });
    }
    const nextRole = String(role || '').trim();
    if (!ALLOWED_MANAGE_ROLES.includes(nextRole)) {
      return res.status(400).json({ success: false, message: '无效的角色' });
    }

    await pool.query(
      `INSERT INTO users (username, email, password, display_name, role, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [
        normalizedUsername,
        String(email || '').trim() || null,
        hashPassword(normalizedPassword),
        String(display_name || '').trim() || normalizedUsername,
        nextRole
      ]
    );

    const [rows] = await pool.query(
      'SELECT id, username, email, display_name, role, status, last_login_at, created_at, unqualified_dimension_preset_name FROM users WHERE username = ? LIMIT 1',
      [normalizedUsername]
    );
    res.json({ success: true, message: '用户已创建', data: toPublicUser(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '账号或邮箱已存在' });
    }
    console.error('创建用户失败:', error);
    res.status(500).json({ success: false, message: '创建用户失败' });
  }
});

router.patch('/users/:id', requireRoles(['system_admin']), async (req, res) => {
  try {
    await ensureUserSchema();
    const id = Number.parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ success: false, message: '无效的用户 id' });
    }

    const [targetRows] = await pool.query(
      'SELECT id, username, role, status FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    const target = targetRows[0];
    if (!target) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }


    const body = req.body || {};
    let nextRole = target.role;


    let nextStatus = target.status;


    if (typeof body.role === 'string' && body.role.trim()) {


      nextRole = body.role.trim();
      if (!ALLOWED_MANAGE_ROLES.includes(nextRole)) {


        return res.status(400).json({ success: false, message: '无效的角色' });


      }


    }


    if (typeof body.status === 'string' && ['active', 'disabled'].includes(body.status)) {
      nextStatus = body.status;
    }

    const demotingSysAdmin =
      target.role === 'system_admin'
      && (nextRole !== 'system_admin' || nextStatus === 'disabled');

    if (demotingSysAdmin && (await countActiveRoleExcluding('system_admin', id)) < 1) {
      return res.status(400).json({ success: false, message: '至少需要保留一名在职的系统管理员' });
    }


    const sets = [];
    const vals = [];

    if (typeof body.username === 'string') {
      const normalizedUsername = String(body.username).trim();
      if (normalizedUsername !== target.username) {
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalizedUsername)) {
          return res.status(400).json({ success: false, message: '账号需为 3-30 位字母、数字或下划线' });
        }
        sets.push('username = ?');
        vals.push(normalizedUsername);
      }
    }

    if (typeof body.display_name === 'string') {
      sets.push('display_name = ?');
      vals.push(String(body.display_name).trim().slice(0, 100) || target.username);


    }


    if (typeof body.email === 'string') {
      sets.push('email = ?');
      vals.push(String(body.email).trim().slice(0, 100) || null);
    }


    if (typeof body.role === 'string' && body.role.trim()) {


      sets.push('role = ?');
      vals.push(nextRole);
    }


    if (typeof body.status === 'string' && ['active', 'disabled'].includes(body.status)) {
      sets.push('status = ?');
      vals.push(nextStatus);


    }


    const np = typeof body.new_password === 'string' ? body.new_password : '';


    if (np) {
      if (np.length < 6) {
        return res.status(400).json({ success: false, message: '新密码至少 6 位' });
      }


      sets.push('password = ?');
      vals.push(hashPassword(np));
    }


    if (!sets.length) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });


    }


    vals.push(id);


    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);

    const [rows] = await pool.query(
      'SELECT id, username, email, display_name, role, status, last_login_at, created_at, unqualified_dimension_preset_name FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    res.json({ success: true, message: '用户已更新', data: toPublicUser(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '账号或邮箱已被其他用户使用' });
    }
    console.error('更新用户失败:', error);


    res.status(500).json({ success: false, message: '更新用户失败' });
  }


});

router.delete('/users/:id', requireRoles(['system_admin']), async (req, res) => {
  try {
    await ensureUserSchema();


    const id = Number.parseInt(req.params.id, 10);


    if (!id) {
      return res.status(400).json({ success: false, message: '无效的用户 id' });
    }


    if (Number(req.user.id) === id) {


      return res.status(400).json({ success: false, message: '不能删除当前登录账号' });
    }


    const [targetRows] = await pool.query('SELECT id, role FROM users WHERE id = ? LIMIT 1', [id]);
    const target = targetRows[0];
    if (!target) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (target.role === 'system_admin' && (await countActiveRoleExcluding('system_admin', id)) < 1) {
      return res.status(400).json({ success: false, message: '至少需要保留一名系统管理员账号' });


    }


    await pool.query('DELETE FROM operation_logs WHERE user_id = ?', [id]);


    await pool.query('DELETE FROM users WHERE id = ?', [id]);


    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('删除用户失败:', error);


    res.status(500).json({ success: false, message: '删除用户失败' });


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
