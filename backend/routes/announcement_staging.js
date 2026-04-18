const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  DEFAULT_STAGING_SOURCE_DIR,
  DEFAULT_WORKSPACE_CACHE_KEY,
  ensureAnnouncementStagingSchema,
  importStagingFromJsonDirectory,
  getAnnouncementStagingOverview,
  getAnnouncementStagingDetail,
  publishAnnouncementStagingBatch,
  deleteAnnouncementStagingBatch,
  deletePublishedAnnouncementStagingBatch,
  updatePublishedAnnouncementStagingBody,
  updateAnnouncementStagingProductType,

  movePublishedAnnouncementStagingBatchToTraceback,

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

function buildStagingQueryConfig(query = {}) {
  const {
    status = '',
    keyword = '',
    product_type = '',
    announcement_type = ''
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
      `重复跳过 ${result.duplicate_count || 0} 个`,
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
  try {
    const deleted = await deleteAnnouncementStagingTraceback(pool, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '倒溯记录不存在或已删除' });
    }

    res.json({
      success: true,
      message: '倒溯记录已删除'
    });
  } catch (error) {
    console.error('删除倒溯记录失败:', error);
    res.status(500).json({ success: false, message: '删除倒溯记录失败' });
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
        ? '待确认批次已发布到飞行检查正式库，并写入备用快照'
        : '待确认批次已发布到抽检正式库，并写入备用快照',
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

router.patch('/:id/product-type', async (req, res) => {
  let connection;

  try {
    const productType = String(req.body?.product_type || '').trim();
    if (!productType) {
      return res.status(400).json({ success: false, message: '产品类型不能为空' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await updateAnnouncementStagingProductType(connection, req.params.id, productType);
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
    const result = await movePublishedAnnouncementStagingBatchToTraceback(
      connection,
      req.params.id,
      req.body?.reason || ''
    );
    await connection.commit();

    res.json({
      success: true,
      message: '已将正式库通告退回倒溯处理中心，并恢复为待确认批次',
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

