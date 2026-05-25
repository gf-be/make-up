-- companies 表：product_category 重命名为 source_product_name（来源产品名称）
-- 同步任务将写入抽检/飞检明细中的 product_name，而非推导的产品分类

ALTER TABLE companies
  CHANGE COLUMN product_category source_product_name VARCHAR(255) NULL COMMENT '来源产品名称';

ALTER TABLE companies
  DROP INDEX idx_companies_product_category;

ALTER TABLE companies
  ADD INDEX idx_companies_source_product_name (source_product_name);
