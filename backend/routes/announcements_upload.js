const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/announcements');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 获取所有公告列表
router.get('/', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, u.username as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND a.type = ?';
      params.push(type);
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (a.title LIKE ? OR a.content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM announcements a WHERE 1=1';
    const countParams = [];
    if (type) {
      countQuery += ' AND a.type = ?';
      countParams.push(type);
    }
    if (status) {
      countQuery += ' AND a.status = ?';
      countParams.push(status);
    }
    if (keyword) {
      countQuery += ' AND (a.title LIKE ? OR a.content LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ success: false, message: '获取公告列表失败' });
  }
});

// 获取公告详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT a.*, u.username as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    // 更新浏览次数
    await pool.query('UPDATE announcements SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取公告详情失败:', error);
    res.status(500).json({ success: false, message: '获取公告详情失败' });
  }
});

// 创建公告（支持文件上传）
router.post('/', upload.single('attachment'), async (req, res) => {
  try {
    const { title, content, announcement_no, publish_date, status = 'published', author_id = 1 } = req.body;

    // 自动提取关键信息
    const inspection_unit = extractInspectionUnit(content);
    const inspection_count = extractInspectionCount(content);

    let attachmentPath = null;
    let attachmentName = null;

    if (req.file) {
      attachmentPath = '/uploads/announcements/' + req.file.filename;
      attachmentName = req.file.originalname;
    }

    const [result] = await pool.query(`
      INSERT INTO announcements (
        title, content, announcement_no, publish_date, status,
        inspection_unit, inspection_count, attachment_path, attachment_name, author_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, content, announcement_no, publish_date, status, inspection_unit, inspection_count, attachmentPath, attachmentName, author_id]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, message: '创建公告失败' });
  }
});

// 更新公告（支持文件上传）
router.put('/:id', upload.single('attachment'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, announcement_no, publish_date, status } = req.body;

    // 自动提取关键信息
    const inspection_unit = extractInspectionUnit(content);
    const inspection_count = extractInspectionCount(content);

    // 获取旧附件路径
    const [oldAnnouncement] = await pool.query('SELECT attachment_path FROM announcements WHERE id = ?', [id]);

    let attachmentPath = null;
    let attachmentName = null;

    if (req.file) {
      // 删除旧附件
      if (oldAnnouncement.length > 0 && oldAnnouncement[0].attachment_path) {
        const oldPath = path.join(__dirname, '..', oldAnnouncement[0].attachment_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      attachmentPath = '/uploads/announcements/' + req.file.filename;
      attachmentName = req.file.originalname;
    }

    await pool.query(`
      UPDATE announcements
      SET title = ?, content = ?, announcement_no = ?, publish_date = ?, status = ?,
          inspection_unit = ?, inspection_count = ?
          ${attachmentPath ? ', attachment_path = ?, attachment_name = ?' : ''}
      WHERE id = ?
    `, attachmentPath
      ? [title, content, announcement_no, publish_date, status, inspection_unit, inspection_count, attachmentPath, attachmentName, id]
      : [title, content, announcement_no, publish_date, status, inspection_unit, inspection_count, id]
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新公告失败:', error);
    res.status(500).json({ success: false, message: '更新公告失败' });
  }
});

// 删除公告
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取附件路径并删除文件
    const [announcement] = await pool.query('SELECT attachment_path FROM announcements WHERE id = ?', [id]);
    if (announcement.length > 0 && announcement[0].attachment_path) {
      const filePath = path.join(__dirname, '..', announcement[0].attachment_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM announcements WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({ success: false, message: '删除公告失败' });
  }
});

// 获取公告相关的检查记录
router.get('/:id/inspections', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT
        id.id,
        id.product_name,
        id.brand,
        id.manufacturer,
        id.inspection_result,
        id.unqualified_items,
        id.inspection_standard
      FROM inspection_details id
      INNER JOIN inspections i ON id.inspection_id = i.id
      WHERE i.announcement_id = ?
      ORDER BY id.created_at DESC
    `, [id]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取相关检查记录失败:', error);
    res.status(500).json({ success: false, message: '获取相关检查记录失败' });
  }
});

// 辅助函数：提取检验单位
function extractInspectionUnit(content) {
  if (!content) return '';
  const match = content.match(/经(.+?)等?(单位|所|中心|院)检验/);
  return match ? match[1].trim() : '';
}

// 辅助函数：提取批次数量
function extractInspectionCount(content) {
  if (!content) return 0;
  const match = content.match(/(\d+)批次.*?(不符合规定|不合格|有问题)/);
  return match ? parseInt(match[1]) : 0;
}

module.exports = router;
