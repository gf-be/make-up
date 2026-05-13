const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const {
  DEFAULT_STAGING_SOURCE_DIR,
  DEFAULT_WORKSPACE_CACHE_KEY,
  ensureAnnouncementStagingSchema,
  importStagingFromJsonDirectory,
  importStagingFromUploadedFiles,
  getAnnouncementStagingOverview,
  getAnnouncementStagingDetail,
  createAnnouncementStagingItem,
  updateAnnouncementStagingItem,
  deleteAnnouncementStagingItem,
  resyncAnnouncementStagingItemsTable,
  publishAnnouncementStagingBatch,
  deleteAnnouncementStagingBatch,
  deletePublishedAnnouncementStagingBatch,
  updatePublishedAnnouncementStagingBody,
  updateAnnouncementStagingInfo,
  updateAnnouncementStagingProductType,

  movePublishedAnnouncementStagingBatchToTraceback,
  movePendingAnnouncementStagingBatchToTraceback,

  listAnnouncementStagingTracebacks,
  markAnnouncementStagingTracebackResolved,
  deleteAnnouncementStagingTraceback,
  getAnnouncementWorkspaceCache,
  saveAnnouncementWorkspaceCache
} = require('../utils/announcementStaging');


const {
  normalizeProductType,
  normalizeAnnouncementType,
  getProductTypeLabel,
  getAnnouncementTypeLabel
} = require('../utils/unqualifiedProducts');
const { ensureInspectionDetailsSchema } = require('../utils/announcementInspectionSync');
const { authenticate } = require('../utils/auth');

const uploadJsonFiles = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const normalizedName = String(file.originalname || '').toLowerCase();
    if (normalizedName.endsWith('.json') || file.mimetype === 'application/json') {
      return cb(null, true);
    }
    return cb(new Error('只允许上传 JSON 文件'));
  },
  limits: {
    files: 200,
    fileSize: 20 * 1024 * 1024
  }
});


function clampPageSize(limit, defaultValue = 10, maxValue = 100) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

function buildTypeInfo(productType, announcementType) {
  const normalizedProductType = normalizeProductType(productType);
  const normalizedAnnouncementType = normalizeAnnouncementType(announcementType);

  return {
    product_type: normalizedProductType,
    announcement_type: normalizedAnnouncementType,
    product_type_label: getProductTypeLabel(normalizedProductType),
    announcement_type_label: getAnnouncementTypeLabel(normalizedAnnouncementType)
  };
}

function parseStagingCalendarYear(yearRaw) {
  const yearParsed = Number.parseInt(String(yearRaw ?? '').trim(), 10);
  return Number.isFinite(yearParsed) && yearParsed >= 1990 && yearParsed <= 2100 ? yearParsed : null;
}

function buildStagingQueryConfig(query = {}, options = {}) {
  const skipYearFilter = Boolean(options.skipYearFilter);
  const {
    status = '',
    keyword = '',
    product_type = '',
    announcement_type = '',
    year: yearQuery = ''
  } = query;

  const conditions = ['1=1'];
  const params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (product_type) {
    conditions.push('product_type = ?');
    params.push(normalizeProductType(product_type));
  }

  if (announcement_type) {
    conditions.push('announcement_type = ?');
    params.push(normalizeAnnouncementType(announcement_type));
  }

  const normalizedKeyword = String(keyword || '').trim();
  if (normalizedKeyword) {
    conditions.push(`(
      title LIKE ? OR
      announcement_no LIKE ? OR
      inspection_unit LIKE ? OR
      source_detail_url LIKE ?
    )`);
    params.push(
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`
    );
  }

  if (!skipYearFilter) {
    const yearParsed = parseStagingCalendarYear(yearQuery);
    if (yearParsed !== null) {
      const ys = String(yearParsed);
      conditions.push(`(
        (publish_date IS NOT NULL AND YEAR(publish_date) = ?)
        OR (
          (publish_date IS NULL OR CAST(publish_date AS CHAR) = '')
          AND (
            announcement_no LIKE ? OR announcement_no LIKE ? OR title LIKE ? OR title LIKE ?
          )
        )
      )`);
      params.push(
        yearParsed,
        `%${ys}年%`,
        `%${ys}-%`,
        `%${ys}年%`,
        `%${ys}年第%`
      );
    }
  }

  return {
    whereClause: conditions.join(' AND '),
    params
  };
}


function mapStagingRow(row = {}) {
  return {
    ...row,
    product_type_label: getProductTypeLabel(row.product_type),
    announcement_type_label: getAnnouncementTypeLabel(row.announcement_type)
  };
}

ensureAnnouncementStagingSchema(pool).catch((error) => {
  console.error('初始化公告临时表失败:', error);
});
ensureInspectionDetailsSchema(pool).catch((error) => {
  console.error('初始化抽检明细表结构失败:', error);
});

router.post('/import-json', async (req, res) => {

  let connection;

  try {
    connection = await pool.getConnection();
    const result = await importStagingFromJsonDirectory(connection, DEFAULT_STAGING_SOURCE_DIR, req.body || {});
    const overview = await getAnnouncementStagingOverview(connection, DEFAULT_STAGING_SOURCE_DIR);

    const parseWarningCount = result.parse_warning_count ?? result.parse_failed_count ?? 0;
    const messageParts = [
      `新增 ${result.created_count || 0} 个`,
      `重复跳过 ${result.duplicate_count || 0} 个（不入倒溯）`,
      `待人工核验 ${parseWarningCount} 个`
    ];


    if (result.error_count > 0) {
      messageParts.push(`异常 ${result.error_count} 个`);
    }

    if (result.delete_failed_count > 0) {
      messageParts.push(`JSON 删除失败 ${result.delete_failed_count} 个`);
    } else {
      messageParts.push(`自动删除源 JSON ${result.deleted_count || 0} 个`);
    }

    res.json({
      success: true,
      message: `导入完成：${messageParts.join('，')}`,
      data: {
        ...result,
        overview
      }
    });
  } catch (error) {
    console.error('导入爬虫 JSON 到临时表失败:', error);
    res.status(500).json({ success: false, message: error.message || '导入爬虫 JSON 到临时表失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/import-json-upload', authenticate, uploadJsonFiles.array('files', 200), async (req, res) => {
  let connection;

  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: '请选择需要上传的 JSON 文件' });
    }

    let relativePaths = [];
    try {
      relativePaths = JSON.parse(req.body?.relative_paths || '[]');
    } catch (error) {
      relativePaths = [];
    }

    const uploadFiles = files.map((file, index) => ({
      ...file,
      relativePath: String(relativePaths[index] || file.originalname || '').replace(/\\/g, '/')
    }));

    connection = await pool.getConnection();
    const result = await importStagingFromUploadedFiles(
      connection,
      uploadFiles,
      {
        product_type: req.body?.product_type || '',
        announcement_type: req.body?.announcement_type || ''
      },
      {
        user_id: req.user.id,
        username: req.user.username
      }
    );
    const overview = await getAnnouncementStagingOverview(connection, DEFAULT_STAGING_SOURCE_DIR);

    const parseWarningCount = result.parse_warning_count ?? result.parse_failed_count ?? 0;
    const messageParts = [
      `上传 ${result.total_files || 0} 个`,
      `新增 ${result.created_count || 0} 个`,
      `重复跳过 ${result.duplicate_count || 0} 个（不入倒溯）`,
      `待人工核验 ${parseWarningCount} 个`
    ];

    if (result.error_count > 0) {
      messageParts.push(`异常 ${result.error_count} 个`);
    }

    res.json({
      success: true,
      message: `上传导入完成：${messageParts.join('，')}`,
      data: {
        ...result,
        overview
      }
    });
  } catch (error) {
    console.error('上传 JSON 到临时表失败:', error);
    res.status(500).json({ success: false, message: error.message || '上传 JSON 到临时表失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get('/overview', async (req, res) => {
  try {
    const overview = await getAnnouncementStagingOverview(pool, DEFAULT_STAGING_SOURCE_DIR);
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('获取临时表概览失败:', error);
    res.status(500).json({ success: false, message: '获取临时表概览失败' });
  }
});

router.get('/tree', async (req, res) => {
  try {
    await ensureAnnouncementStagingSchema(pool);
    const { whereClause, params } = buildStagingQueryConfig(req.query);
    const [rows] = await pool.query(
      `
        SELECT
          id,
          title,
          announcement_no,
          publish_date,
          inspection_unit,
          inspection_count,
          attachment_count,
          parsed_detail_count,
          counterfeit_count,
          product_type,
          announcement_type,
          status,
          published_announcement_id,
          published_supervision_id,
          source_json_file,
          source_file_name,
          source_relative_path,
          imported_by_username,
          imported_at,
          import_source,
          source_detail_url,
          primary_attachment_name,
          confirmed_at,
          created_at,
          updated_at
        FROM announcement_staging_batches
        WHERE ${whereClause}
        ORDER BY
          CASE WHEN status = 'pending' THEN 0 ELSE 1 END ASC,
          product_type ASC,
          publish_date DESC,
          updated_at DESC,
          id DESC
      `,
      params
    );

    res.json({
      success: true,
      data: rows.map(mapStagingRow)
    });
  } catch (error) {
    console.error('获取临时批次树形列表失败:', error);
    res.status(500).json({ success: false, message: '获取临时批次树形列表失败' });
  }
});

function deriveStagingBatchDisplayYear(batch = {}) {
  const pd = batch.publish_date;
  if (pd) {
    const y = Number.parseInt(String(pd).slice(0, 4), 10);
    if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
      return y;
    }
  }
  const sourceText = `${pd || ''} ${batch.announcement_no || ''} ${batch.title || ''}`.replace(/\s+/g, '');
  const match = sourceText.match(/(20\d{2})年|^(20\d{2})-/);
  const fromText = Number.parseInt(match?.[1] || match?.[2] || '', 10);
  if (Number.isFinite(fromText) && fromText >= 1990 && fromText <= 2100) {
    return fromText;
  }
  return null;
}

router.get('/filter-years', async (req, res) => {
  try {
    await ensureAnnouncementStagingSchema(pool);
    const { whereClause, params } = buildStagingQueryConfig(req.query, { skipYearFilter: true });
    const [rows] = await pool.query(
      `
        SELECT publish_date, announcement_no, title
        FROM announcement_staging_batches
        WHERE ${whereClause}
      `,
      params
    );
    const yearSet = new Set();
    rows.forEach((row) => {
      const y = deriveStagingBatchDisplayYear(row);
      if (y !== null) yearSet.add(y);
    });
    const years = [...yearSet].sort((a, b) => b - a);
    res.json({ success: true, data: { years } });
  } catch (error) {
    console.error('获取通告导入年份筛选列表失败:', error);
    res.status(500).json({ success: false, message: '获取通告导入年份筛选列表失败' });
  }
});

router.get('/tracebacks', async (req, res) => {
  try {
    const rows = await listAnnouncementStagingTracebacks(pool, {
      id: req.query.id || '',
      handled_status: req.query.handled_status || '',
      trace_type: req.query.trace_type || '',
      product_type: req.query.product_type || '',
      keyword: req.query.keyword || '',
      limit: req.query.limit || 50
    });


    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('获取导入倒溯列表失败:', error);
    res.status(500).json({ success: false, message: '获取导入倒溯列表失败' });
  }
});

router.post('/tracebacks/:id/resolve', async (req, res) => {
  try {
    await markAnnouncementStagingTracebackResolved(pool, req.params.id);
    res.json({
      success: true,
      message: '倒溯记录已标记为已处理'
    });
  } catch (error) {
    console.error('更新倒溯记录状态失败:', error);
    res.status(500).json({ success: false, message: '更新倒溯记录状态失败' });
  }
});

router.delete('/tracebacks/:id', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const result = await deleteAnnouncementStagingTraceback(connection, req.params.id);
    if (!result.deleted) {
      await connection.commit();
      return res.json({
        success: true,
        message: '倒溯记录已删除或不存在',
        data: result
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: '倒溯记录已删除',
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('删除倒溯记录失败:', error);
    res.status(500).json({ success: false, message: '删除倒溯记录失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get('/workspace-cache', async (req, res) => {

  try {
    const cache = await getAnnouncementWorkspaceCache(pool, req.query.cache_key || DEFAULT_WORKSPACE_CACHE_KEY);
    res.json({
      success: true,
      data: cache
    });
  } catch (error) {
    console.error('获取导入工作区缓存失败:', error);
    res.status(500).json({ success: false, message: '获取导入工作区缓存失败' });
  }
});

router.post('/workspace-cache', async (req, res) => {
  try {
    const cache = await saveAnnouncementWorkspaceCache(
      pool,
      req.body?.payload || {},
      req.body?.cache_key || DEFAULT_WORKSPACE_CACHE_KEY
    );
    res.json({
      success: true,
      message: '工作区缓存已保存',
      data: cache
    });
  } catch (error) {
    console.error('保存导入工作区缓存失败:', error);
    res.status(500).json({ success: false, message: '保存导入工作区缓存失败' });
  }
});

router.post('/confirm-all', async (req, res) => {
  try {
    await ensureAnnouncementStagingSchema(pool);
    await ensureInspectionDetailsSchema(pool);


    const requestIds = Array.isArray(req.body?.ids)
      ? req.body.ids.map((item) => Number(item)).filter(Boolean)
      : [];
    const hasSpecifiedIds = requestIds.length > 0;
    const placeholders = hasSpecifiedIds ? requestIds.map(() => '?').join(', ') : '';
    const [pendingRows] = await pool.query(
      `
        SELECT id, title, status, product_type, announcement_type
        FROM announcement_staging_batches
        WHERE status = 'pending'
        ${hasSpecifiedIds ? `AND id IN (${placeholders})` : ''}
        ORDER BY publish_date DESC, updated_at DESC, id DESC
      `,
      requestIds
    );

    if (pendingRows.length === 0) {
      const overview = await getAnnouncementStagingOverview(pool, DEFAULT_STAGING_SOURCE_DIR);
      return res.json({
        success: true,
        message: '当前没有待导入正式库的批次',
        data: {
          total: 0,
          success_count: 0,
          failed_count: 0,
          has_failures: false,
          items: [],
          failures: [],
          overview
        }
      });
    }

    const successItems = [];
    const failures = [];

    for (const batch of pendingRows) {
      let connection;
      try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const result = await publishAnnouncementStagingBatch(connection, batch.id);
        await connection.commit();
        successItems.push({
          id: batch.id,
          title: batch.title,
          status: 'success',
          product_type: batch.product_type,
          announcement_type: batch.announcement_type,
          ...result
        });
      } catch (error) {
        if (connection) {
          await connection.rollback();
        }
        failures.push({
          id: batch.id,
          title: batch.title,
          status: 'failed',
          product_type: batch.product_type,
          announcement_type: batch.announcement_type,
          message: error.message || '导入正式库失败'
        });
      } finally {
        if (connection) {
          connection.release();
        }
      }
    }

    const overview = await getAnnouncementStagingOverview(pool, DEFAULT_STAGING_SOURCE_DIR);
    res.json({
      success: true,
      message: failures.length > 0
        ? `批量导入完成：成功 ${successItems.length} 个，失败 ${failures.length} 个`
        : `批量导入完成：成功导入 ${successItems.length} 个批次到正式库`,
      data: {
        total: pendingRows.length,
        success_count: successItems.length,
        failed_count: failures.length,
        has_failures: failures.length > 0,
        items: successItems,
        failures,
        overview
      }
    });
  } catch (error) {
    console.error('批量导入正式库失败:', error);
    res.status(500).json({ success: false, message: error.message || '批量导入正式库失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureAnnouncementStagingSchema(pool);

    const { page = 1, limit = 10 } = req.query;
    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageSize = clampPageSize(limit);
    const offset = (currentPage - 1) * pageSize;
    const { whereClause, params } = buildStagingQueryConfig(req.query);

    const [rows] = await pool.query(
      `
        SELECT
          id,
          title,
          announcement_no,
          publish_date,
          inspection_unit,
          inspection_count,
          attachment_count,
          parsed_detail_count,
          counterfeit_count,
          product_type,
          announcement_type,
          status,
          published_announcement_id,
          published_supervision_id,
          source_json_file,
          source_file_name,
          source_relative_path,
          imported_by_username,
          imported_at,
          import_source,
          source_detail_url,
          primary_attachment_name,
          confirmed_at,
          created_at,
          updated_at
        FROM announcement_staging_batches
        WHERE ${whereClause}
        ORDER BY
          CASE WHEN status = 'pending' THEN 0 ELSE 1 END ASC,
          publish_date DESC,
          updated_at DESC,
          id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM announcement_staging_batches WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: rows.map(mapStagingRow),
      pagination: {
        total: Number(countRows[0]?.total || 0),
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(Number(countRows[0]?.total || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('获取临时批次列表失败:', error);
    res.status(500).json({ success: false, message: '获取临时批次列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await getAnnouncementStagingDetail(pool, req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, message: '待确认批次不存在' });
    }

    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    console.error('获取临时批次详情失败:', error);
    res.status(500).json({ success: false, message: '获取临时批次详情失败' });
  }
});

router.post('/:id/items', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const detail = await createAnnouncementStagingItem(connection, req.params.id, req.body || {});
    await connection.commit();
    res.json({
      success: true,
      message: '产品明细已新增',
      data: detail
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('新增临时批次产品明细失败:', error);
    res.status(500).json({ success: false, message: error.message || '新增产品明细失败' });
  } finally {
    if (connection) connection.release();
  }
});

router.put('/:id/items', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const detail = await updateAnnouncementStagingItem(connection, req.params.id, req.body?.locator || {}, req.body?.item || {});
    await connection.commit();
    res.json({
      success: true,
      message: '产品明细已更新',
      data: detail
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('更新临时批次产品明细失败:', error);
    res.status(500).json({ success: false, message: error.message || '更新产品明细失败' });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id/items', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const detail = await deleteAnnouncementStagingItem(connection, req.params.id, req.body?.locator || req.body || {});
    await connection.commit();
    res.json({
      success: true,
      message: '产品明细已删除',
      data: detail
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('删除临时批次产品明细失败:', error);
    res.status(500).json({ success: false, message: error.message || '删除产品明细失败' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/:id/sync-items', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const detail = await resyncAnnouncementStagingItemsTable(connection, req.params.id);
    await connection.commit();
    res.json({
      success: true,
      message: '产品明细已写入 announcement_staging_items',
      data: detail
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('同步临时批次明细表失败:', error);
    if (error.message === '待确认批次不存在') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message || '同步临时明细表失败' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/:id/confirm', async (req, res) => {
  let connection;

  try {
    await ensureInspectionDetailsSchema(pool);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const result = await publishAnnouncementStagingBatch(connection, req.params.id);
    await connection.commit();

    res.json({
      success: true,
      message: result.published_target === 'supervisions'
        ? '待确认批次已发布到飞行检查正式库，已写入备用快照并清理临时区'
        : '待确认批次已发布到抽检正式库，已写入备用快照并清理临时区',
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('确认发布临时批次失败:', error);
    res.status(500).json({ success: false, message: error.message || '确认发布临时批次失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.put('/:id/body', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await updatePublishedAnnouncementStagingBody(connection, req.params.id, req.body?.content);
    await connection.commit();

    res.json({
      success: true,
      message: result.updated_published_id
        ? '通告正文已同步更新到临时批次和正式库'
        : '通告正文已更新到临时批次',
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新通告正文失败:', error);

    if (error.message === '待确认批次不存在') {
      return res.status(404).json({ success: false, message: error.message });
    }

    if (error.message === '通告正文不能为空') {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message || '更新通告正文失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.put('/:id/info', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await updateAnnouncementStagingInfo(connection, req.params.id, req.body || {});
    await connection.commit();

    res.json({
      success: true,
      message: result.updated_published_id
        ? '通告基础信息已同步更新到临时批次和正式库'
        : '通告基础信息已更新到临时批次',
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新临时批次基础信息失败:', error);

    if (error.message === '待确认批次不存在') {
      return res.status(404).json({ success: false, message: error.message });
    }

    if (String(error.message || '').includes('不能切换「抽检 / 飞检」类型')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message || '更新临时批次基础信息失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.patch('/:id/product-type', async (req, res) => {
  let connection;

  try {
    const hasProductType = Object.prototype.hasOwnProperty.call(req.body || {}, 'product_type');
    const hasAnnouncementType = Object.prototype.hasOwnProperty.call(req.body || {}, 'announcement_type');
    if (!hasProductType && !hasAnnouncementType) {
      return res.status(400).json({ success: false, message: '请至少提供 product_type 或 announcement_type' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await updateAnnouncementStagingProductType(connection, req.params.id, {
      ...(hasProductType ? { product_type: req.body.product_type } : {}),
      ...(hasAnnouncementType ? { announcement_type: req.body.announcement_type } : {})
    });
    await connection.commit();

    res.json({
      success: true,
      message: result.updated_published_id
        ? '产品类型已同步更新到临时批次和正式库'
        : '产品类型已更新到临时批次',
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新临时批次产品类型失败:', error);

    if (error.message === '待确认批次不存在') {
      return res.status(404).json({ success: false, message: error.message });
    }

    if (String(error.message || '').includes('不能切换「抽检 / 飞检」类型')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message || '更新临时批次产品类型失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/:id/retreat-to-traceback', async (req, res) => {

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const detail = await getAnnouncementStagingDetail(connection, req.params.id);
    const batch = detail?.batch || null;
    const reasonText = typeof req.body?.reason === 'string' ? req.body.reason : '';

    let result;

    if (!batch) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '待确认批次不存在' });
    }

    if (batch.status === 'confirmed') {
      result = await movePublishedAnnouncementStagingBatchToTraceback(
        connection,
        req.params.id,
        reasonText
      );
    } else if (batch.status === 'pending') {
      result = await movePendingAnnouncementStagingBatchToTraceback(
        connection,
        req.params.id,
        reasonText
      );
    } else {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `当前批次状态为「${batch.status}」，不支持退回倒溯处理`
      });
    }

    await connection.commit();

    const message =
      batch.status === 'confirmed'
        ? '已将正式库通告退回倒溯处理，临时批次恢复为待确认'
        : '核验打回已记入倒溯处理，并已移出临时区';

    res.json({
      success: true,
      message,
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('退回倒溯处理失败:', error);

    if (error.message === '待确认批次不存在') {
      return res.status(404).json({ success: false, message: error.message });
    }

    if (error.message === '该批次尚未导入正式库，无法退至倒溯处理') {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (
      error.message === '仅待确认的批次可通过核验打回进入倒溯处理'
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message || '退回倒溯处理失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.delete('/:id', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await deleteAnnouncementStagingBatch(connection, req.params.id);
    await connection.commit();

    res.json({
      success: true,
      message: result.deleted_published
        ? (result.published_target === 'supervisions'
            ? '已删除当前通告，并同步删除飞行检查正式库记录'
            : '已删除当前通告，并同步删除抽检正式库记录')
        : '已删除当前待确认通告',
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('删除通告失败:', error);

    if (error.message === '待确认批次不存在') {
      return res.status(404).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message || '删除通告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.delete('/:id/published', async (req, res) => {

  let connection;


  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await deletePublishedAnnouncementStagingBatch(connection, req.params.id);
    await connection.commit();

    res.json({
      success: true,
      message: result.published_target === 'supervisions'
        ? '已删除飞行检查正式库记录，并恢复为待确认批次'
        : '已删除抽检正式库记录，并恢复为待确认批次',
      data: result
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('删除正式库记录失败:', error);

    if (error.message === '待确认批次不存在') {
      return res.status(404).json({ success: false, message: error.message });
    }

    if (error.message === '该批次尚未导入正式库，无需删除') {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message || '删除正式库记录失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


module.exports = router;

