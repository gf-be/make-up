const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const {
  parseFlightInspectionText,
  parseFlightInspectionAttachment,
  ensureFlightInspectionDetailTable,
  replaceFlightInspectionDetails
} = require('../utils/flightInspectionAttachmentParser');
const {
  ensureCompaniesSamplingSchema,
  syncCompaniesFromFlightInspectionDetails
} = require('../utils/companySamplingSync');


const EXTRA_COLUMNS = [
  { name: 'company_name', definition: 'VARCHAR(255) NULL' },
  { name: 'production_license_no', definition: 'VARCHAR(255) NULL' },
  { name: 'company_address', definition: 'TEXT NULL' },
  { name: 'inspection_basis', definition: 'LONGTEXT NULL' },
  { name: 'defects_and_problems', definition: 'LONGTEXT NULL' },
  { name: 'handling_measures', definition: 'LONGTEXT NULL' },
  { name: 'publish_date', definition: 'DATE NULL' },
  { name: 'attachment_path', definition: 'VARCHAR(500) NULL' },
  { name: 'attachment_name', definition: 'VARCHAR(200) NULL' }
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/supervisions');
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
  storage,
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
    fileSize: 10 * 1024 * 1024
  }
});

const uploadAttachments = upload.fields([
  { name: 'attachments', maxCount: 20 },
  { name: 'attachment', maxCount: 1 }
]);

async function ensureSupervisionAttachmentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supervision_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supervision_id INT NOT NULL,
      attachment_name VARCHAR(255) NOT NULL,
      attachment_path VARCHAR(500) NOT NULL,
      attachment_type VARCHAR(50),
      sort_order INT DEFAULT 0,
      parse_supported TINYINT(1) DEFAULT 0,
      parse_message VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_supervision_attachments_supervision (supervision_id),
      CONSTRAINT fk_supervision_attachments_supervision
        FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureFlightInspectionColumns() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS supervisions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      company_name VARCHAR(255),
      production_license_no VARCHAR(255),
      company_address TEXT,
      supervision_date DATE,
      publish_date DATE,
      supervision_unit VARCHAR(100),
      inspection_basis LONGTEXT,
      defects_and_problems LONGTEXT,
      handling_measures LONGTEXT,
      attachment_path VARCHAR(500),
      attachment_name VARCHAR(200),
      region VARCHAR(100),
      level ENUM('national', 'provincial', 'municipal') NOT NULL,
      supervision_type VARCHAR(50),
      content LONGTEXT,
      rectification_deadline DATE,
      status ENUM('ongoing', 'completed', 'pending_rectification') DEFAULT 'ongoing',
      source VARCHAR(100),
      view_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_supervisions_company_name (company_name),
      INDEX idx_supervisions_publish_date (publish_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const column of EXTRA_COLUMNS) {
    const [rows] = await pool.query('SHOW COLUMNS FROM supervisions LIKE ?', [column.name]);
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE supervisions ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  await ensureFlightInspectionDetailTable(pool);
  await ensureSupervisionAttachmentsTable();
  await ensureCompaniesSamplingSchema(pool);
}


function buildFlightInspectionSelect() {
  return `
    SELECT
      s.id,
      s.title,
      s.company_name,
      s.production_license_no,
      s.company_address,
      s.supervision_unit AS inspection_unit,
      s.inspection_basis,
      s.defects_and_problems,
      s.handling_measures,
      s.publish_date,
      s.supervision_date,
      s.region,
      s.level,
      s.supervision_type,
      s.content,
      s.rectification_deadline,
      s.status,
      s.source,
      s.view_count,
      s.attachment_path,
      s.attachment_name,
      (
        SELECT COUNT(*)
        FROM supervision_attachments sa
        WHERE sa.supervision_id = s.id
      ) AS attachment_count,
      (
        SELECT COUNT(DISTINCT fid.company_name)
        FROM flight_inspection_detail fid
        WHERE fid.supervision_id = s.id AND fid.company_name IS NOT NULL AND fid.company_name != ''
      ) AS company_count,
      s.created_at,
      s.updated_at
    FROM supervisions s
  `;
}

function collectUploadedFiles(req) {
  if (!req.files) {
    return [];
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  return [
    ...(req.files.attachments || []),
    ...(req.files.attachment || [])
  ];
}

async function replaceSupervisionAttachments(connection, supervisionId, attachments) {
  await connection.query('DELETE FROM supervision_attachments WHERE supervision_id = ?', [supervisionId]);

  if (!attachments || attachments.length === 0) {
    return;
  }

  for (const attachment of attachments) {
    await connection.query(
      `
        INSERT INTO supervision_attachments (
          supervision_id, attachment_name, attachment_path, attachment_type,
          sort_order, parse_supported, parse_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        supervisionId,
        attachment.attachment_name,
        attachment.attachment_path,
        attachment.attachment_type || null,
        attachment.sort_order || 0,
        attachment.parse_supported ? 1 : 0,
        attachment.parse_message || null
      ]
    );
  }
}

async function getSupervisionAttachments(executor, supervisionId) {
  const [rows] = await executor.query(
    `
      SELECT id, supervision_id, attachment_name, attachment_path, attachment_type,
             sort_order, parse_supported, parse_message, created_at, updated_at
      FROM supervision_attachments
      WHERE supervision_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    [supervisionId]
  );

  return rows;
}

function buildAttachmentDetailGroups(attachments = [], detailRows = []) {
  const groups = [];
  const usedRowIndexes = new Set();

  const attachRows = (rows = [], attachment = {}, index = 0) => {
    const matchedRows = [];

    rows.forEach((row, rowIndex) => {
      if (usedRowIndexes.has(rowIndex)) {
        return;
      }

      const samePath = attachment.attachment_path && row.attachment_path
        && attachment.attachment_path === row.attachment_path;
      const sameName = !samePath && attachment.attachment_name && row.attachment_name
        && attachment.attachment_name === row.attachment_name;

      if (samePath || sameName) {
        matchedRows.push(row);
        usedRowIndexes.add(rowIndex);
      }
    });

    groups.push({
      ...attachment,
      group_type: 'attachment',
      sort_order: attachment.sort_order || index + 1,
      company_count: matchedRows.filter((item) => String(item.company_name || '').trim()).length || matchedRows.length,
      detail_rows: matchedRows
    });
  };

  attachments.forEach((attachment, index) => {
    attachRows(detailRows, attachment, index);
  });

  detailRows.forEach((row, index) => {
    if (usedRowIndexes.has(index)) {
      return;
    }

    groups.push({
      id: null,
      supervision_id: row.supervision_id || null,
      attachment_name: row.attachment_name || row.company_name || row.title || `企业明细${index + 1}`,
      attachment_path: row.attachment_path || null,
      attachment_type: null,
      sort_order: groups.length + 1,
      parse_supported: 1,
      parse_message: null,
      group_type: row.attachment_name || row.attachment_path ? 'attachment' : 'content',
      company_count: String(row.company_name || '').trim() ? 1 : 0,
      detail_rows: [row]
    });
  });

  return groups.sort((a, b) => {
    const orderA = Number(a.sort_order || 0);
    const orderB = Number(b.sort_order || 0);
    return orderA - orderB;
  });
}

function buildFlightInspectionSummary(detailRows = []) {

  const rows = Array.isArray(detailRows) ? detailRows : [];
  const firstRow = rows[0] || null;
  const uniqueCompanyNames = Array.from(
    new Set(rows.map((item) => String(item.company_name || '').trim()).filter(Boolean))
  );
  const uniqueInspectionUnits = Array.from(
    new Set(rows.map((item) => String(item.inspection_unit || '').trim()).filter(Boolean))
  );
  const uniquePublishDates = Array.from(
    new Set(rows.map((item) => String(item.publish_date || '').trim()).filter(Boolean))
  );
  const companyCount = uniqueCompanyNames.length;

  return {
    firstRow,
    companyCount,
    companyNameSummary: companyCount <= 1
      ? (uniqueCompanyNames[0] || firstRow?.company_name || null)
      : `${uniqueCompanyNames[0]}等${companyCount}家企业`,
    inspectionUnitSummary: uniqueInspectionUnits.length <= 1
      ? (uniqueInspectionUnits[0] || firstRow?.inspection_unit || null)
      : uniqueInspectionUnits.join('；'),
    publishDateSummary: uniquePublishDates[0] || firstRow?.publish_date || null,
    combinedRawText: rows.map((item) => item.raw_text).filter(Boolean).join('\n\n====================\n\n') || null
  };
}

async function parseAttachmentSafely(file) {

  if (!file) {
    return {
      supported: false,
      attachment_type: null,
      parsedCount: 0,
      rows: [],
      message: ''
    };
  }

  try {
    return await parseFlightInspectionAttachment(file.path);
  } catch (error) {
    console.error('解析飞行检查附件失败:', error);
    return {
      supported: false,
      attachment_type: path.extname(file.originalname || '').replace('.', '') || 'unknown',
      parsedCount: 0,
      rows: [],
      message: '附件已上传，但自动解析失败，请检查文件内容或格式。'
    };
  }
}

async function parseUploadedAttachments(files = []) {
  if (!files || files.length === 0) {
    return {
      attachments: [],
      rows: [],
      parsedCount: 0,
      supportedCount: 0,
      message: ''
    };
  }

  const attachmentResults = await Promise.all(
    files.map(async (file, index) => {
      const parsed = await parseAttachmentSafely(file);
      const attachmentPath = `/uploads/supervisions/${file.filename}`;
      const attachmentName = file.originalname;

      return {
        attachment: {
          attachment_name: attachmentName,
          attachment_path: attachmentPath,
          attachment_type: parsed.attachment_type || path.extname(file.originalname || '').replace('.', '') || null,
          sort_order: index + 1,
          parse_supported: parsed.supported,
          parse_message: parsed.message || null
        },
        rows: (parsed.rows || []).map((row) => ({
          ...row,
          attachment_name: attachmentName,
          attachment_path: attachmentPath
        })),
        supported: parsed.supported,
        message: parsed.message || ''
      };
    })
  );

  const rows = attachmentResults.flatMap((item) => item.rows).map((row, index) => ({
    ...row,
    sequence_no: index + 1
  }));
  const messages = attachmentResults
    .filter((item) => item.message)
    .map((item) => `${item.attachment.attachment_name}：${item.message}`);

  return {
    attachments: attachmentResults.map((item) => item.attachment),
    rows,
    parsedCount: rows.length,
    supportedCount: attachmentResults.filter((item) => item.supported).length,
    message: messages.join('；')
  };
}

function normalizeFlightInspectionPayload(body = {}, detailRows = [], attachmentInfo = {}) {
  const summary = buildFlightInspectionSummary(detailRows);
  const detail = summary.firstRow || {};
  const inspectionUnit = body.inspection_unit || body.supervision_unit || summary.inspectionUnitSummary || null;
  const publishDate = body.publish_date || detail.publish_date || body.supervision_date || summary.publishDateSummary || null;
  const companyName = body.company_name || summary.companyNameSummary || null;
  const title = body.title || detail.title || (
    summary.companyCount > 1
      ? `${summary.companyCount}家企业飞行检查通告`
      : (companyName ? `${companyName}飞行检查结果` : '化妆品飞行检查通告')
  );

  return {
    title,
    company_name: companyName,
    production_license_no: body.production_license_no || detail.production_license_no || null,
    company_address: body.company_address || detail.company_address || null,
    supervision_date: body.supervision_date || publishDate,
    publish_date: publishDate,
    supervision_unit: inspectionUnit,
    inspection_basis: body.inspection_basis || detail.inspection_basis || null,
    defects_and_problems: body.defects_and_problems || detail.defects_and_problems || null,
    handling_measures: body.handling_measures || detail.handling_measures || null,
    region: body.region || null,
    level: body.level || 'national',
    supervision_type: body.supervision_type || '飞行检查',
    content: body.content || summary.combinedRawText || detail.raw_text || null,
    rectification_deadline: body.rectification_deadline || null,
    status: body.status || 'ongoing',
    source: body.source || '附件上传',
    attachment_path: attachmentInfo.attachment_path || null,
    attachment_name: attachmentInfo.attachment_name || null
  };
}

async function getExistingAttachmentInfo(id) {
  const [rows] = await pool.query('SELECT attachment_path, attachment_name FROM supervisions WHERE id = ?', [id]);
  return rows[0] || { attachment_path: null, attachment_name: null };
}


ensureFlightInspectionColumns().catch((error) => {
  console.error('初始化飞行检查字段失败:', error);
});

// 获取所有飞行检查通告列表
router.get('/', async (req, res) => {
  try {
    await ensureFlightInspectionColumns();

    const {
      level,
      company_name,
      inspection_unit,
      page = 1,
      limit = 10,
      keyword
    } = req.query;
    const currentPage = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const offset = (currentPage - 1) * pageSize;

    let query = `${buildFlightInspectionSelect()} WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) as total FROM supervisions WHERE 1=1';
    const params = [];
    const countParams = [];

    if (level) {
      query += ' AND level = ?';
      countQuery += ' AND level = ?';
      params.push(level);
      countParams.push(level);
    }

    if (company_name) {
      query += ` AND (
        s.company_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM flight_inspection_detail fid
          WHERE fid.supervision_id = s.id AND fid.company_name LIKE ?
        )
      )`;
      countQuery += ` AND (
        company_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM flight_inspection_detail fid
          WHERE fid.supervision_id = supervisions.id AND fid.company_name LIKE ?
        )
      )`;
      params.push(`%${company_name}%`, `%${company_name}%`);
      countParams.push(`%${company_name}%`, `%${company_name}%`);
    }


    if (inspection_unit) {
      query += ' AND supervision_unit LIKE ?';
      countQuery += ' AND supervision_unit LIKE ?';
      params.push(`%${inspection_unit}%`);
      countParams.push(`%${inspection_unit}%`);
    }

    if (keyword) {
      query += ' AND (title LIKE ? OR company_name LIKE ? OR production_license_no LIKE ? OR defects_and_problems LIKE ? OR handling_measures LIKE ?)';
      countQuery += ' AND (title LIKE ? OR company_name LIKE ? OR production_license_no LIKE ? OR defects_and_problems LIKE ? OR handling_measures LIKE ?)';
      const keywordParams = Array(5).fill(`%${keyword}%`);
      params.push(...keywordParams);
      countParams.push(...keywordParams);
    }

    query += ' ORDER BY COALESCE(publish_date, supervision_date) DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [rows] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(countResult[0].total || 0),
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(Number(countResult[0].total || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('获取飞行检查通告列表失败:', error);
    res.status(500).json({ success: false, message: '获取飞行检查通告列表失败' });
  }
});

// 获取飞行检查通告详情
router.get('/:id', async (req, res) => {
  try {
    await ensureFlightInspectionColumns();

    const { id } = req.params;
    const [rows] = await pool.query(`${buildFlightInspectionSelect()} WHERE s.id = ?`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '飞行检查通告不存在' });
    }

    const [detailRows] = await pool.query(
      'SELECT * FROM flight_inspection_detail WHERE supervision_id = ? ORDER BY sequence_no ASC, id ASC',
      [id]
    );
    let attachments = await getSupervisionAttachments(pool, id);

    if (attachments.length === 0 && (rows[0].attachment_path || rows[0].attachment_name)) {
      attachments = [{
        id: null,
        supervision_id: Number(id),
        attachment_name: rows[0].attachment_name || '附件',
        attachment_path: rows[0].attachment_path,
        attachment_type: null,
        sort_order: 1,
        parse_supported: 0,
        parse_message: null
      }];
    }

    await pool.query('UPDATE supervisions SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({
      success: true,
      data: {
        ...rows[0],
        detail_record: detailRows[0] || null,
        detail_rows: detailRows,
        attachments,
        attachment_detail_groups: buildAttachmentDetailGroups(attachments, detailRows)
      }
    });


  } catch (error) {
    console.error('获取飞行检查通告详情失败:', error);
    res.status(500).json({ success: false, message: '获取飞行检查通告详情失败' });
  }
});

// 创建飞行检查通告
router.post('/', uploadAttachments, async (req, res) => {
  let connection;

  try {
    await ensureFlightInspectionColumns();

    const uploadedFiles = collectUploadedFiles(req);
    const parsedAttachments = await parseUploadedAttachments(uploadedFiles);
    const fallbackDetail = uploadedFiles.length === 0 && req.body.content ? parseFlightInspectionText(req.body.content) : null;
    const detailRows = parsedAttachments.rows.length > 0
      ? parsedAttachments.rows
      : (fallbackDetail ? [{ ...fallbackDetail, sequence_no: 1 }] : []);
    const primaryAttachment = parsedAttachments.attachments[0] || {};
    const payload = normalizeFlightInspectionPayload(req.body, detailRows, primaryAttachment);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(`
      INSERT INTO supervisions (
        title, company_name, production_license_no, company_address,
        supervision_date, publish_date, supervision_unit, inspection_basis,
        defects_and_problems, handling_measures, attachment_path, attachment_name,
        region, level, supervision_type, content, rectification_deadline, status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.title,
      payload.company_name,
      payload.production_license_no,
      payload.company_address,
      payload.supervision_date,
      payload.publish_date,
      payload.supervision_unit,
      payload.inspection_basis,
      payload.defects_and_problems,
      payload.handling_measures,
      payload.attachment_path,
      payload.attachment_name,
      payload.region,
      payload.level,
      payload.supervision_type,
      payload.content,
      payload.rectification_deadline,
      payload.status,
      payload.source
    ]);

    await replaceFlightInspectionDetails(connection, result.insertId, detailRows);
    await replaceSupervisionAttachments(connection, result.insertId, parsedAttachments.attachments);
    const companySyncResult = await syncCompaniesFromFlightInspectionDetails(connection, result.insertId);
    await connection.commit();

    res.json({
      success: true,
      data: {
        id: result.insertId,
        extracted_info: {
          company_name: payload.company_name,
          inspection_unit: payload.supervision_unit,
          publish_date: payload.publish_date
        },
        parsed_detail_count: detailRows.length,
        attachment_count: parsedAttachments.attachments.length,
        synced_company_count: companySyncResult.company_count,
        parse_message: parsedAttachments.message,
        parse_supported: uploadedFiles.length > 0 ? parsedAttachments.supportedCount > 0 : Boolean(fallbackDetail)
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('创建飞行检查通告失败:', error);
    res.status(500).json({ success: false, message: '创建飞行检查通告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// 更新飞行检查通告
router.put('/:id', uploadAttachments, async (req, res) => {
  let connection;

  try {
    await ensureFlightInspectionColumns();

    const { id } = req.params;
    const uploadedFiles = collectUploadedFiles(req);
    const parsedAttachments = await parseUploadedAttachments(uploadedFiles);
    const fallbackDetail = uploadedFiles.length === 0 && req.body.content ? parseFlightInspectionText(req.body.content) : null;
    const detailRows = parsedAttachments.rows.length > 0
      ? parsedAttachments.rows
      : (fallbackDetail ? [{ ...fallbackDetail, sequence_no: 1 }] : []);
    const existingAttachment = uploadedFiles.length > 0 ? {} : await getExistingAttachmentInfo(id);
    const payload = normalizeFlightInspectionPayload(
      req.body,
      detailRows,
      parsedAttachments.attachments[0] || existingAttachment
    );

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(`
      UPDATE supervisions
      SET title = ?, company_name = ?, production_license_no = ?, company_address = ?,
          supervision_date = ?, publish_date = ?, supervision_unit = ?, inspection_basis = ?,
          defects_and_problems = ?, handling_measures = ?, attachment_path = ?, attachment_name = ?,
          region = ?, level = ?, supervision_type = ?, content = ?, rectification_deadline = ?, status = ?, source = ?
      WHERE id = ?
    `, [
      payload.title,
      payload.company_name,
      payload.production_license_no,
      payload.company_address,
      payload.supervision_date,
      payload.publish_date,
      payload.supervision_unit,
      payload.inspection_basis,
      payload.defects_and_problems,
      payload.handling_measures,
      payload.attachment_path,
      payload.attachment_name,
      payload.region,
      payload.level,
      payload.supervision_type,
      payload.content,
      payload.rectification_deadline,
      payload.status,
      payload.source,
      id
    ]);

    if (uploadedFiles.length > 0 || detailRows.length > 0) {
      await replaceFlightInspectionDetails(connection, id, detailRows);
      const companySyncResult = await syncCompaniesFromFlightInspectionDetails(connection, id);

      if (uploadedFiles.length > 0) {
        await replaceSupervisionAttachments(connection, id, parsedAttachments.attachments);
      }

      await connection.commit();

      return res.json({
        success: true,
        message: '更新成功',
        data: {
          parsed_detail_count: detailRows.length,
          attachment_count: uploadedFiles.length > 0 ? parsedAttachments.attachments.length : undefined,
          synced_company_count: companySyncResult.company_count,
          parse_message: parsedAttachments.message,
          parse_supported: uploadedFiles.length > 0 ? parsedAttachments.supportedCount > 0 : Boolean(fallbackDetail)
        }
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: '更新成功',
      data: {
        parsed_detail_count: 0,
        parse_message: '',
        parse_supported: false
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新飞行检查通告失败:', error);
    res.status(500).json({ success: false, message: '更新飞行检查通告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// 删除飞行检查通告
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM supervisions WHERE id = ?', [id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除飞行检查通告失败:', error);
    res.status(500).json({ success: false, message: '删除飞行检查通告失败' });
  }
});

// 获取飞行检查统计数据
router.get('/stats/overview', async (req, res) => {
  try {
    await ensureFlightInspectionColumns();

    const [total] = await pool.query('SELECT COUNT(*) as count FROM supervisions');
    const [national] = await pool.query("SELECT COUNT(*) as count FROM supervisions WHERE level = 'national'");
    const [provincial] = await pool.query("SELECT COUNT(*) as count FROM supervisions WHERE level = 'provincial'");
    const [municipal] = await pool.query("SELECT COUNT(*) as count FROM supervisions WHERE level = 'municipal'");

    res.json({
      success: true,
      data: {
        total: Number(total[0].count || 0),
        national: Number(national[0].count || 0),
        provincial: Number(provincial[0].count || 0),
        municipal: Number(municipal[0].count || 0)
      }
    });
  } catch (error) {
    console.error('获取飞行检查统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取飞行检查统计数据失败' });
  }
});

module.exports = router;
