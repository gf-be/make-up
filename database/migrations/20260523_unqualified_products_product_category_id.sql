-- unqualified_products 新增产品分类 id，关联 unqualified_product_category_catalog
-- 应用启动时 backend ensureUnqualifiedProductsTable 也会执行同等变更

ALTER TABLE unqualified_products
  ADD COLUMN product_category_id INT NULL AFTER product_category;

ALTER TABLE unqualified_products
  ADD INDEX idx_unqualified_products_product_category_id (product_category_id);

ALTER TABLE unqualified_products
  ADD CONSTRAINT fk_unqualified_products_product_category
    FOREIGN KEY (product_category_id) REFERENCES unqualified_product_category_catalog(id) ON DELETE SET NULL;

-- 按主表 product_category 文本回填 id（需 catalog 表已有对应词条）
UPDATE unqualified_products up
INNER JOIN unqualified_product_category_catalog c
  ON c.product_type = up.product_type
 AND TRIM(c.category_name) = TRIM(up.product_category)
SET up.product_category_id = c.id
WHERE up.product_category_id IS NULL
  AND up.product_category IS NOT NULL
  AND TRIM(up.product_category) <> '';
