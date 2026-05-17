const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireRoles } = require('../utils/auth');
const {
  ensureUnqualifiedProductsTable,
  normalizeProductType,
  getProductTypeLabel
} = require('../utils/unqualifiedProducts');

const requireCategoryManagers = () => requireRoles(['developer', 'data_admin']);

async function ensureReady() {
  await ensureUnqualifiedProductsTable(pool);
}

router.get('/product-types', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const [distinctResult, catalogResult] = await Promise.all([
      pool.query(`
        SELECT DISTINCT product_type AS value
        FROM unqualified_products
        WHERE product_type IS NOT NULL AND TRIM(product_type) <> ''
        ORDER BY product_type ASC
      `),
      pool.query(`
        SELECT product_type, display_label
        FROM unqualified_product_type_catalog
        ORDER BY product_type ASC
      `)
    ]);

    const distinctRows = distinctResult[0];
    const catalogTypeRows = catalogResult[0];
    const defaults = ['cosmetics', 'food', 'medical_device'];
    const merged = [];
    const seen = new Set();

    for (const v of defaults) {
      const n = normalizeProductType(v);
      if (!seen.has(n)) {
        seen.add(n);
        merged.push({ value: n, label: getProductTypeLabel(n) });
      }
    }

    for (const row of catalogTypeRows || []) {
      const n = normalizeProductType(row.product_type);
      if (!seen.has(n)) {
        seen.add(n);
        const lbl = String(row.display_label || '').trim() || getProductTypeLabel(n);
        merged.push({ value: n, label: lbl });
      }
    }

    for (const row of distinctRows || []) {
      const n = normalizeProductType(row.value);
      if (!seen.has(n)) {
        seen.add(n);
        merged.push({ value: n, label: getProductTypeLabel(n) });
      }
    }

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error('获取产品类型列表失败:', error);
    res.status(500).json({ success: false, message: '获取产品类型列表失败' });
  }
});

router.post('/product-types', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const raw = String(req.body?.product_type || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: '产品类型不能为空' });
    }

    const canonical = normalizeProductType(raw);
    if (canonical.length > 50) {
      return res.status(400).json({ success: false, message: '产品类型最长 50 字符' });
    }

    const labelRaw = req.body?.display_label != null ? String(req.body.display_label).trim() : '';
    const displayLabel = labelRaw.length ? labelRaw.slice(0, 100) : null;

    try {
      await pool.query(
        `
          INSERT INTO unqualified_product_type_catalog (product_type, display_label)
          VALUES (?, ?)
        `,
        [canonical, displayLabel]
      );
    } catch (insertErr) {
      if (insertErr?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: '该产品类型已存在于词条库中' });
      }
      throw insertErr;
    }

    const label = displayLabel || getProductTypeLabel(canonical);

    res.json({
      success: true,
      message: '已新增产品类型',
      data: { value: canonical, label }
    });
  } catch (error) {
    console.error('新增产品类型失败:', error);
    res.status(500).json({ success: false, message: '新增产品类型失败' });
  }
});

function normalizeAbstractProductPayload(body = {}) {
  const productType = normalizeProductType(body.product_type || 'cosmetics');
  const categoryName = String(body.category_name || '').trim();
  const abstractName = String(body.abstract_name || body.name || '').trim();
  const imageUrl = body.image_url == null ? '' : String(body.image_url).trim();

  if (!categoryName) {
    const error = new Error('所属分类不能为空');
    error.statusCode = 400;
    throw error;
  }
  if (categoryName.length > 100) {
    const error = new Error('所属分类最长 100 字符');
    error.statusCode = 400;
    throw error;
  }
  if (!abstractName) {
    const error = new Error('抽象产品名称不能为空');
    error.statusCode = 400;
    throw error;
  }
  if (abstractName.length > 150) {
    const error = new Error('抽象产品名称最长 150 字符');
    error.statusCode = 400;
    throw error;
  }
  if (imageUrl.length > 1000) {
    const error = new Error('图片地址最长 1000 字符');
    error.statusCode = 400;
    throw error;
  }

  return {
    productType,
    categoryName,
    abstractName,
    imageUrl: imageUrl || null
  };
}

async function assertCategoryExists(connection, productType, categoryName) {
  const [[row]] = await connection.query(
    `
      SELECT id
      FROM unqualified_product_category_catalog
      WHERE product_type = ? AND category_name = ?
      LIMIT 1
    `,
    [productType, categoryName]
  );
  if (!row) {
    const error = new Error('请先在当前类型下新增目标分类');
    error.statusCode = 400;
    throw error;
  }
}

router.get('/abstract-products', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const productType = normalizeProductType(req.query.product_type || 'cosmetics');
    const categoryName = String(req.query.category_name || '').trim();
    if (!categoryName) {
      return res.status(400).json({ success: false, message: '缺少分类名称 category_name' });
    }

    const [rows] = await pool.query(
      `
        SELECT id, product_type, category_name, abstract_name, image_url, created_at, updated_at
        FROM unqualified_product_abstract_catalog
        WHERE product_type = ? AND category_name = ?
        ORDER BY abstract_name ASC, id ASC
      `,
      [productType, categoryName]
    );

    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error('获取抽象产品列表失败:', error);
    res.status(500).json({ success: false, message: '获取抽象产品列表失败' });
  }
});

router.post('/abstract-products', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const { productType, categoryName, abstractName, imageUrl } = normalizeAbstractProductPayload(req.body);
    await assertCategoryExists(pool, productType, categoryName);

    try {
      await pool.query(
        `
          INSERT INTO unqualified_product_abstract_catalog (
            product_type, category_name, abstract_name, image_url
          )
          VALUES (?, ?, ?, ?)
        `,
        [productType, categoryName, abstractName, imageUrl]
      );
    } catch (insertErr) {
      if (insertErr?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: '该分类下已存在相同抽象产品名称' });
      }
      throw insertErr;
    }

    const [[created]] = await pool.query(
      `
        SELECT id, product_type, category_name, abstract_name, image_url, created_at, updated_at
        FROM unqualified_product_abstract_catalog
        WHERE product_type = ? AND category_name = ? AND abstract_name = ?
        LIMIT 1
      `,
      [productType, categoryName, abstractName]
    );

    res.json({ success: true, message: '已新增抽象产品', data: created });
  } catch (error) {
    console.error('新增抽象产品失败:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : '新增抽象产品失败' });
  }
});

router.put('/abstract-products/:id', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: '无效的 id' });
    }

    const { productType, categoryName, abstractName, imageUrl } = normalizeAbstractProductPayload(req.body);
    await assertCategoryExists(pool, productType, categoryName);

    try {
      const [result] = await pool.query(
        `
          UPDATE unqualified_product_abstract_catalog
          SET product_type = ?, category_name = ?, abstract_name = ?, image_url = ?
          WHERE id = ?
        `,
        [productType, categoryName, abstractName, imageUrl, id]
      );
      if (!Number(result?.affectedRows || 0)) {
        return res.status(404).json({ success: false, message: '抽象产品不存在或已删除' });
      }
    } catch (updateErr) {
      if (updateErr?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: '该分类下已存在相同抽象产品名称' });
      }
      throw updateErr;
    }

    const [[updated]] = await pool.query(
      `
        SELECT id, product_type, category_name, abstract_name, image_url, created_at, updated_at
        FROM unqualified_product_abstract_catalog
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json({ success: true, message: '已更新抽象产品', data: updated });
  } catch (error) {
    console.error('更新抽象产品失败:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : '更新抽象产品失败' });
  }
});

router.delete('/abstract-products/:id', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: '无效的 id' });
    }

    const [result] = await pool.query('DELETE FROM unqualified_product_abstract_catalog WHERE id = ?', [id]);
    if (!Number(result?.affectedRows || 0)) {
      return res.status(404).json({ success: false, message: '抽象产品不存在或已删除' });
    }

    res.json({ success: true, message: '已删除抽象产品' });
  } catch (error) {
    console.error('删除抽象产品失败:', error);
    res.status(500).json({ success: false, message: '删除抽象产品失败' });
  }
});

router.get('/category-products', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const productType = normalizeProductType(req.query.product_type || 'cosmetics');
    const categoryName = String(req.query.category_name || '').trim();
    if (!categoryName) {
      return res.status(400).json({ success: false, message: '缺少分类名称 category_name' });
    }
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 500;

    const [productRows] = await pool.query(
      `
        SELECT DISTINCT up.id, up.product_name
        FROM unqualified_products up
        WHERE up.product_type = ?
          AND (
            TRIM(COALESCE(up.product_category, '')) = ?
            OR EXISTS (
              SELECT 1
              FROM unqualified_product_category_items upci
              WHERE upci.unqualified_product_id = up.id
                AND TRIM(upci.product_category) = ?
            )
          )
        ORDER BY up.product_name ASC
        LIMIT ?
      `,
      [productType, categoryName, categoryName, limit]
    );

    res.json({
      success: true,
      data: productRows || [],
      meta: {
        limit,
        count: (productRows || []).length
      }
    });
  } catch (error) {
    console.error('获取分类下产品列表失败:', error);
    res.status(500).json({ success: false, message: '获取分类下产品列表失败' });
  }
});

router.post('/assign-product-category', requireCategoryManagers(), async (req, res) => {
  let connection;
  try {
    await ensureReady();

    const productId = Number.parseInt(req.body?.product_id, 10);
    const productType = normalizeProductType(req.body?.product_type || 'cosmetics');
    const fromCategory = String(req.body?.from_category_name || '').trim();
    const toCategory = String(req.body?.to_category_name || '').trim();

    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ success: false, message: '无效的产品 id' });
    }
    if (!fromCategory || !toCategory) {
      return res.status(400).json({ success: false, message: '来源分类与目标分类不能为空' });
    }
    if (fromCategory === toCategory) {
      return res.status(400).json({ success: false, message: '目标分类与当前相同' });
    }
    if (toCategory.length > 100) {
      return res.status(400).json({ success: false, message: '目标分类名称过长' });
    }

    connection = await pool.getConnection();

    const [[targetCatalog]] = await connection.query(
      `
        SELECT id
        FROM unqualified_product_category_catalog
        WHERE product_type = ? AND category_name = ?
        LIMIT 1
      `,
      [productType, toCategory]
    );
    if (!targetCatalog) {
      return res.status(400).json({ success: false, message: '请先在当前类型下新增目标分类词条' });
    }

    await connection.beginTransaction();

    const [[product]] = await connection.query(
      `
        SELECT id, product_type, product_category
        FROM unqualified_products
        WHERE id = ?
        LIMIT 1
      `,
      [productId]
    );

    if (!product) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '产品明细不存在' });
    }

    if (normalizeProductType(product.product_type) !== productType) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '产品类型与明细不一致' });
    }

    const mainMatch = String(product.product_category || '').trim() === fromCategory;

    const [tagRows] = await connection.query(
      `
        SELECT id
        FROM unqualified_product_category_items
        WHERE unqualified_product_id = ?
          AND TRIM(product_category) = ?
      `,
      [productId, fromCategory]
    );

    if (!mainMatch && !(tagRows || []).length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '该产品不属于所选来源分类' });
    }

    for (const tag of tagRows || []) {
      const [[existsTo]] = await connection.query(
        `
          SELECT id
          FROM unqualified_product_category_items
          WHERE unqualified_product_id = ?
            AND TRIM(product_category) = ?
          LIMIT 1
        `,
        [productId, toCategory]
      );

      if (existsTo) {
        await connection.query('DELETE FROM unqualified_product_category_items WHERE id = ?', [tag.id]);
      } else {
        await connection.query(
          `
            UPDATE unqualified_product_category_items
            SET product_category = ?
            WHERE id = ?
          `,
          [toCategory, tag.id]
        );
      }
    }

    if (mainMatch) {
      await connection.query(
        `
          UPDATE unqualified_products
          SET product_category = ?
          WHERE id = ?
        `,
        [toCategory, productId]
      );
    }

    await connection.commit();
    res.json({ success: true, message: '已更新产品分类' });
  } catch (error) {
    try {
      if (connection) {
        await connection.rollback();
      }
    } catch {
      /* ignore */
    }
    console.error('修改产品分类失败:', error);
    res.status(500).json({ success: false, message: '修改产品分类失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get('/list', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const productType = normalizeProductType(req.query.product_type || 'cosmetics');

    const [catalogRows] = await pool.query(
      `
        SELECT c.id, c.product_type, c.category_name, c.created_at,
          (
            SELECT COUNT(DISTINCT up.id)
            FROM unqualified_products up
            WHERE up.product_type = c.product_type
              AND (
                TRIM(COALESCE(up.product_category, '')) = c.category_name
                OR EXISTS (
                  SELECT 1
                  FROM unqualified_product_category_items upci
                  WHERE upci.unqualified_product_id = up.id
                    AND TRIM(upci.product_category) = c.category_name
                )
              )
          ) AS usage_count
        FROM unqualified_product_category_catalog c
        WHERE c.product_type = ?
        ORDER BY c.category_name ASC
      `,
      [productType]
    );

    res.json({
      success: true,
      data: (catalogRows || []).map((row) => ({
        ...row,
        usage_count: Number(row.usage_count || 0)
      }))
    });
  } catch (error) {
    console.error('获取产品分类词条失败:', error);
    res.status(500).json({ success: false, message: '获取产品分类词条失败' });
  }
});

router.post('/', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const productType = normalizeProductType(req.body?.product_type || 'cosmetics');
    const categoryName = String(req.body?.category_name || '').trim();
    if (!categoryName) {
      return res.status(400).json({ success: false, message: '分类名称不能为空' });
    }
    if (categoryName.length > 100) {
      return res.status(400).json({ success: false, message: '分类名称最长 100 字符' });
    }

    try {
      await pool.query(
        `
          INSERT INTO unqualified_product_category_catalog (product_type, category_name)
          VALUES (?, ?)
        `,
        [productType, categoryName]
      );
    } catch (insertErr) {
      if (insertErr?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: '该类型下已存在相同分类名称' });
      }
      throw insertErr;
    }

    const [[created]] = await pool.query(
      `
        SELECT id, product_type, category_name, created_at
        FROM unqualified_product_category_catalog
        WHERE product_type = ? AND category_name = ?
        LIMIT 1
      `,
      [productType, categoryName]
    );

    res.json({ success: true, message: '已新增', data: created });
  } catch (error) {
    console.error('新增产品分类词条失败:', error);
    res.status(500).json({ success: false, message: '新增失败' });
  }
});

router.delete('/:id', requireCategoryManagers(), async (req, res) => {
  try {
    await ensureReady();
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: '无效的 id' });
    }

    const [result] = await pool.query('DELETE FROM unqualified_product_category_catalog WHERE id = ?', [id]);
    const affected = Number(result?.affectedRows || 0);
    if (!affected) {
      return res.status(404).json({ success: false, message: '记录不存在或已删除' });
    }

    res.json({ success: true, message: '已删除' });
  } catch (error) {
    console.error('删除产品分类词条失败:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

module.exports = router;
