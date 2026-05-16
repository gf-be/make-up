-- 使用次数仅以 unqualified_product_usage_records.use_count 汇总为准：
-- 删除主表冗余列（若曾添加）及旧的汇总表。
-- 应用启动时 backend 也会执行同等清理（ensureUnqualifiedProductsTable）。

DROP TABLE IF EXISTS unqualified_product_usage_stats;

-- MySQL 8.0.29+ 可用: ALTER TABLE unqualified_products DROP COLUMN IF EXISTS usage_count;
-- 兼容旧版时请手动确认列存在后执行：
-- ALTER TABLE unqualified_products DROP COLUMN usage_count;
