const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const {
  ensureAnnouncementProductDetailsTable,
  parseAnnouncementAttachment,
  replaceAnnouncementProductDetails,
  getAnnouncementProductDetailSummary
} = require('../utils/announcementAttachmentParser');
const {
  ensureCompaniesSamplingSchema,
  syncCompaniesFromAnnouncementDetails,
  removeAnnouncementCompanySampling
} = require('../utils/companySamplingSync');



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
function extractAnnouncementInfo(content = '') {
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
    info.inspection_count = parseInt(countMatch[1], 10);
  }

  // 提取检验年份
  const yearMatch = content.match(/(\d{4})年.*?化妆品抽样检验/);
  if (yearMatch) {
    info.inspection_date = yearMatch[1] + '-01-01';
  }

  return info;
}

function normalizeInspectionCount(value, fallback = 0) {
  const count = parseInt(value, 10);
  return Number.isNaN(count) ? fallback : count;
}

async function parseAttachmentSafely(file) {
  if (!file) {
    return {
      supported: false,
      attachment_type: null,
      parsedCount: 0,
      counterfeitCount: 0,
      rows: [],
      message: ''
    };
  }

  try {
    return await parseAnnouncementAttachment(file.path);
  } catch (error) {
    console.error('解析公告附件失败:', error);
    return {
      supported: false,
      attachment_type: path.extname(file.originalname || '').replace('.', '') || 'unknown',
      parsedCount: 0,
      counterfeitCount: 0,
      rows: [],
      message: '附件已上传，但自动解析失败，请检查文件内容或格式。'
    };
  }
}

ensureAnnouncementProductDetailsTable(pool)
  .then(() => ensureCompaniesSamplingSchema(pool))
  .catch((error) => {
    console.error('初始化公告相关数据表失败:', error);
  });


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
      SELECT
        a.*, 
        u.username as author_name,
        (
          SELECT COUNT(*)
          FROM announcement_product_details apd
          WHERE apd.announcement_id = a.id
        ) as product_detail_count,
        (
          SELECT COUNT(*)
          FROM announcement_product_details apd
          WHERE apd.announcement_id = a.id AND apd.is_counterfeit = 1
        ) as counterfeit_count
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

// 获取公告关联的批次不符合规定化妆品明细
router.get('/:announcementId/product-details', async (req, res) => {
  try {
    const { announcementId } = req.params;
    const {
      unqualified_item = '',
      company_keyword = '',
      sample_unit_keyword = '',
      is_counterfeit = ''
    } = req.query;

    await ensureAnnouncementProductDetailsTable(pool);

    let [existingRows] = await pool.query(
      `
        SELECT id
        FROM announcement_product_details
        WHERE announcement_id = ?
        LIMIT 1
      `,
      [announcementId]
    );

    if (existingRows.length === 0) {
      const [announcementRows] = await pool.query(
        'SELECT attachment_path, attachment_name FROM announcements WHERE id = ?',
        [announcementId]
      );

      const announcement = announcementRows[0];
      if (announcement?.attachment_path) {
        const attachmentFilePath = path.join(__dirname, '..', announcement.attachment_path.replace(/^\//, ''));

        if (fs.existsSync(attachmentFilePath)) {
          const parsedAttachment = await parseAttachmentSafely({
            path: attachmentFilePath,
            originalname: announcement.attachment_name
          });

          if (parsedAttachment.rows.length > 0) {
            await replaceAnnouncementProductDetails(pool, announcementId, parsedAttachment.rows);
          }
        }
      }
    }

    const conditions = ['announcement_id = ?'];
    const params = [announcementId];
    const normalizedUnqualifiedItem = String(unqualified_item).trim();
    const normalizedCompanyKeyword = String(company_keyword).trim();
    const normalizedSampleUnitKeyword = String(sample_unit_keyword).trim();
    const hasCounterfeitFilter = is_counterfeit === '0' || is_counterfeit === '1';

    if (normalizedUnqualifiedItem) {
      conditions.push('unqualified_items LIKE ?');
      params.push(`%${normalizedUnqualifiedItem}%`);
    }

    if (normalizedCompanyKeyword) {
      conditions.push('company_names LIKE ?');
      params.push(`%${normalizedCompanyKeyword}%`);
    }

    if (normalizedSampleUnitKeyword) {
      conditions.push('sample_unit_name LIKE ?');
      params.push(`%${normalizedSampleUnitKeyword}%`);
    }

    if (hasCounterfeitFilter) {
      conditions.push('is_counterfeit = ?');
      params.push(Number(is_counterfeit));
    }

    const [rows] = await pool.query(
      `
        SELECT *
        FROM announcement_product_details
        WHERE ${conditions.join(' AND ')}
        ORDER BY sequence_no ASC, id ASC
      `,
      params
    );

    const summary = await getAnnouncementProductDetailSummary(pool, announcementId);
    const filteredCounterfeitCount = rows.reduce((count, row) => count + (row.is_counterfeit ? 1 : 0), 0);

    res.json({
      success: true,
      data: rows,
      summary: {
        ...summary,
        filtered_total: rows.length,
        filtered_counterfeit_count: filteredCounterfeitCount,
        has_filters: Boolean(
          normalizedUnqualifiedItem ||
          normalizedCompanyKeyword ||
          normalizedSampleUnitKeyword ||
          hasCounterfeitFilter
        )
      }
    });
  } catch (error) {
    console.error('获取公告批次明细失败:', error);
    res.status(500).json({ success: false, message: '获取公告批次明细失败' });
  }
});


// 上传公告（带附件和自动解析）
router.post('/', upload.single('attachment'), async (req, res) => {
  let connection;

  try {
    const { title, content, announcement_no, publish_date, status, author_id, inspection_unit, inspection_count } = req.body;

    const extractedInfo = extractAnnouncementInfo(content);
    const parsedAttachment = await parseAttachmentSafely(req.file);
    const parsedInspectionCount = parsedAttachment.parsedCount > 0 ? parsedAttachment.parsedCount : 0;

    const finalInspectionUnit = inspection_unit || extractedInfo.inspection_unit;
    const finalInspectionCount = parsedInspectionCount || normalizeInspectionCount(inspection_count, extractedInfo.inspection_count);
    const attachmentPath = req.file ? `/uploads/announcements/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(`
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

    if (parsedAttachment.rows.length > 0) {
      await replaceAnnouncementProductDetails(connection, result.insertId, parsedAttachment.rows);
    }

    const companySyncResult = await syncCompaniesFromAnnouncementDetails(
      connection,
      result.insertId,
      publish_date || null
    );

    await connection.commit();

    res.json({
      success: true,
      data: {
        id: result.insertId,

        extracted_info: {
          inspection_unit: finalInspectionUnit,
          inspection_count: finalInspectionCount
        },
        parsed_detail_count: parsedAttachment.parsedCount,
        counterfeit_count: parsedAttachment.counterfeitCount,
        synced_company_count: companySyncResult.company_count,
        parse_message: parsedAttachment.message,
        parse_supported: parsedAttachment.supported
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, message: '创建公告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 更新公告
router.put('/:id', upload.single('attachment'), async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const { title, content, announcement_no, publish_date, status, inspection_unit, inspection_count } = req.body;

    const extractedInfo = extractAnnouncementInfo(content);
    const parsedAttachment = await parseAttachmentSafely(req.file);
    const parsedInspectionCount = parsedAttachment.parsedCount > 0 ? parsedAttachment.parsedCount : 0;
    const finalInspectionUnit = inspection_unit || extractedInfo.inspection_unit;
    const finalInspectionCount = parsedInspectionCount || normalizeInspectionCount(inspection_count, extractedInfo.inspection_count);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (req.file) {
      const attachmentPath = `/uploads/announcements/${req.file.filename}`;
      const attachmentName = req.file.originalname;
      await connection.query(`
        UPDATE announcements
        SET title = ?, content = ?, announcement_no = ?, publish_date = ?,
            inspection_unit = ?, inspection_count = ?,
            attachment_path = ?, attachment_name = ?, status = ?
        WHERE id = ?
      `, [
        title,
        content,
        announcement_no,
        publish_date,
        finalInspectionUnit,
        finalInspectionCount,
        attachmentPath,
        attachmentName,
        status,
        id
      ]);

      await replaceAnnouncementProductDetails(connection, id, parsedAttachment.rows);
    } else {
      await connection.query(`
        UPDATE announcements
        SET title = ?, content = ?, announcement_no = ?, publish_date = ?,
            inspection_unit = ?, inspection_count = ?, status = ?
        WHERE id = ?
      `, [
        title,
        content,
        announcement_no,
        publish_date,
        finalInspectionUnit,
        finalInspectionCount,
        status,
        id
      ]);
    }

    const companySyncResult = await syncCompaniesFromAnnouncementDetails(
      connection,
      id,
      publish_date || null
    );

    await connection.commit();

    res.json({
      success: true,

      message: '更新成功',
      data: {
        parsed_detail_count: parsedAttachment.parsedCount,
        counterfeit_count: parsedAttachment.counterfeitCount,
        synced_company_count: companySyncResult.company_count,
        parse_message: parsedAttachment.message,
        parse_supported: parsedAttachment.supported
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新公告失败:', error);
    res.status(500).json({ success: false, message: '更新公告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// 删除公告
router.delete('/:id', async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await removeAnnouncementCompanySampling(connection, id);

    await connection.query('DELETE FROM inspection_details WHERE inspection_id IN (SELECT id FROM inspections WHERE announcement_id = ?)', [id]);
    await connection.query('DELETE FROM inspections WHERE announcement_id = ?', [id]);
    await connection.query('DELETE FROM announcements WHERE id = ?', [id]);

    await connection.commit();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('删除公告失败:', error);
    res.status(500).json({ success: false, message: '删除公告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
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
