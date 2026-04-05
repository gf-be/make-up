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
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF、Word或Excel文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 自动提取公告关键信息
function extractAnnouncementInfo(content) {
  const info = {
    inspection_unit: null,
    inspection_count: 0,
    inspection_date: null
  };

  // 提取检验单位
  const unitMatch = content.match(/经(.+?)等?(单位|所|中心|院)检验/);
  if (unitMatch) {
    info.inspection_unit = unitMatch[1].trim();
  }

  // 提取批次数量
  const countMatch = content.match(/(\d+)批次.*?(不符合规定|不合格|有问题)/);
  if (countMatch) {
    info.inspection_count = parseInt(countMatch[1]);
  }

  // 提取检验年份
  const yearMatch = content.match(/(\d{4})年.*?化妆品抽样检验/);
  if (yearMatch) {
    info.inspection_date = yearMatch[1] + '-01-01';
  }

  return info;
}

// 获取所有公告列表
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, u.username as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (a.title LIKE ? OR a.content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY a.publish_date DESC, a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM announcements a WHERE 1=1';
    const countParams = [];
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

// 上传公告（带附件和自动解析）
router.post('/', upload.single('attachment'), async (req, res) => {
  try {
    const { title, content, announcement_no, publish_date, status, author_id, inspection_unit, inspection_count } = req.body;

    // 自动提取关键信息（如果前端没有提供）
    let extractedInfo = extractAnnouncementInfo(content);

    // 优先使用前端传来的提取信息
    const finalInspectionUnit = inspection_unit || extractedInfo.inspection_unit;
    const finalInspectionCount = inspection_count ? parseInt(inspection_count) : extractedInfo.inspection_count;

    const attachmentPath = req.file ? `/uploads/announcements/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    const [result] = await pool.query(`
      INSERT INTO announcements (
        title, content, announcement_no, publish_date,
        inspection_unit, inspection_count, attachment_path, attachment_name,
        status, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      content,
      announcement_no,
      publish_date,
      finalInspectionUnit,
      finalInspectionCount,
      attachmentPath,
      attachmentName,
      status || 'published',
      author_id
    ]);

    res.json({
      success: true,
      data: {
        id: result.insertId,
        extracted_info: {
          inspection_unit: finalInspectionUnit,
          inspection_count: finalInspectionCount
        }
      }
    });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, message: '创建公告失败' });
  }
});

// 更新公告
router.put('/:id', upload.single('attachment'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, announcement_no, publish_date, status } = req.body;

    // 如果有新附件，更新附件信息
    let updateQuery, updateParams;
    if (req.file) {
      const attachmentPath = `/uploads/announcements/${req.file.filename}`;
      const attachmentName = req.file.originalname;
      updateQuery = `
        UPDATE announcements
        SET title = ?, content = ?, announcement_no = ?, publish_date = ?,
            attachment_path = ?, attachment_name = ?, status = ?
        WHERE id = ?
      `;
      updateParams = [title, content, announcement_no, publish_date,
                    attachmentPath, attachmentName, status, id];
    } else {
      updateQuery = `
        UPDATE announcements
        SET title = ?, content = ?, announcement_no = ?, publish_date = ?, status = ?
        WHERE id = ?
      `;
      updateParams = [title, content, announcement_no, publish_date, status, id];
    }

    await pool.query(updateQuery, updateParams);

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

    // 删除关联的检查记录
    await pool.query('DELETE FROM inspection_details WHERE inspection_id IN (SELECT id FROM inspections WHERE announcement_id = ?)', [id]);
    await pool.query('DELETE FROM inspections WHERE announcement_id = ?', [id]);

    // 删除公告
    await pool.query('DELETE FROM announcements WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({ success: false, message: '删除公告失败' });
  }
});

// 获取公告相关的检查详情
router.get('/:announcementId/inspections', async (req, res) => {
  try {
    const { announcementId } = req.params;

    const [rows] = await pool.query(`
      SELECT id.*, c.name as company_name, c.brand as company_brand
      FROM inspection_details id
      LEFT JOIN inspections i ON id.inspection_id = i.id
      LEFT JOIN companies c ON id.company_id = c.id
      WHERE i.announcement_id = ?
      ORDER BY id.inspection_result DESC
    `, [announcementId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取公告相关检查详情失败:', error);
    res.status(500).json({ success: false, message: '获取公告相关检查详情失败' });
  }
});

module.exports = router;
