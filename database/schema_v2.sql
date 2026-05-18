-- 化妆品资讯系统数据库结构 v2
CREATE DATABASE IF NOT EXISTS cosmetics_info DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cosmetics_info;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role ENUM('developer', 'data_admin', 'normal_user') DEFAULT 'normal_user',
    status ENUM('active', 'disabled') DEFAULT 'active',
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告表（抽样检查公告）
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT,
    announcement_no VARCHAR(50),  -- 公告编号，如"2026年第6号"
    publish_date DATE,  -- 公告发布日期
    inspection_start_date DATE,  -- 检验开始日期（自动提取）
    inspection_end_date DATE,  -- 检验结束日期（自动提取）
    inspection_unit VARCHAR(500),  -- 检验单位（自动提取）
    inspection_count INT DEFAULT 0,  -- 抽检批次总数（自动提取，来自正文解析）
    sampling_unqualified_batch_count INT NULL COMMENT '抽检不合格批次数',
    sampling_qualified_batch_count INT NULL COMMENT '抽检合格批次数',
    sampling_total_batch_count INT NULL COMMENT '抽检总批次数',
    attachment_path VARCHAR(500),  -- 附件路径
    attachment_name VARCHAR(200),  -- 附件原名
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',  -- 产品类型
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',  -- 通告类型
    source_detail_url VARCHAR(500),  -- 来源详情页
    source_page VARCHAR(500),  -- 来源分页或栏目
    source_json_file VARCHAR(500),  -- 来源 JSON 文件
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',

    author_id INT,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_announcements_product_type (product_type),
    INDEX idx_announcements_announcement_type (announcement_type),
    INDEX idx_announcements_source_detail_url (source_detail_url(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 公告批次不符合规定化妆品明细表
CREATE TABLE IF NOT EXISTS announcement_product_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id INT NOT NULL,
    sequence_no INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    company_names TEXT,
    company_addresses TEXT,
    manufacturer_name VARCHAR(500),
    manufacturer_address TEXT,
    operator_name VARCHAR(500),
    operator_address TEXT,
    sample_unit_name VARCHAR(500),
    sample_unit_address TEXT,
    package_spec VARCHAR(255),
    batch_no VARCHAR(255),
    production_date VARCHAR(100),
    expiry_date VARCHAR(255),
    product_region VARCHAR(255),
    registration_no VARCHAR(255),
    production_license_no VARCHAR(255),
    inspection_institution VARCHAR(255),
    unqualified_items LONGTEXT,
    inspection_result LONGTEXT,
    requirement LONGTEXT,
    remarks LONGTEXT,
    is_counterfeit TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    INDEX idx_apd_announcement_id (announcement_id),
    INDEX idx_apd_sequence_no (sequence_no),
    INDEX idx_apd_product_name (product_name),
    INDEX idx_apd_is_counterfeit (is_counterfeit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 食品抽检通报原始拆解表（爬虫 JSON 入库，正式发布后关联 announcements）
CREATE TABLE IF NOT EXISTS food_inspection (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    announcement_no VARCHAR(100),
    publish_date DATE,
    source_detail_url VARCHAR(500),
    source_page VARCHAR(500),
    notice_category VARCHAR(100),
    notice_category_label VARCHAR(100),
    classification_status VARCHAR(50),
    content_text LONGTEXT,
    content_preview LONGTEXT,
    attachment_count INT DEFAULT 0,
    parsed_detail_count INT DEFAULT 0,
    staging_batch_id INT,
    published_announcement_id INT,
    raw_payload LONGTEXT,
    source_json_file VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_food_inspection_source_url (source_detail_url(191)),
    INDEX idx_food_inspection_publish_date (publish_date),
    INDEX idx_food_inspection_category (notice_category),
    INDEX idx_food_inspection_staging (staging_batch_id),
    INDEX idx_food_inspection_published (published_announcement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_inspection_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    food_inspection_id INT NOT NULL,
    attachment_name VARCHAR(500) NOT NULL,
    attachment_url VARCHAR(800),
    local_path VARCHAR(800),
    file_ext VARCHAR(50),
    attachment_type VARCHAR(80),
    supported TINYINT(1) DEFAULT 0,
    parsed_count INT DEFAULT 0,
    parse_message VARCHAR(1000),
    raw_payload LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (food_inspection_id) REFERENCES food_inspection(id) ON DELETE CASCADE,
    INDEX idx_food_attachment_notice (food_inspection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_inspection_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    food_inspection_id INT NOT NULL,
    attachment_id INT,
    sequence_no INT NOT NULL DEFAULT 1,
    product_name VARCHAR(500) NOT NULL,
    company_names TEXT,
    company_addresses TEXT,
    manufacturer_name VARCHAR(500),
    manufacturer_address TEXT,
    operator_name VARCHAR(500),
    operator_address TEXT,
    sample_unit_name VARCHAR(500),
    sample_unit_address TEXT,
    package_spec VARCHAR(255),
    batch_no VARCHAR(255),
    production_date VARCHAR(100),
    expiry_date VARCHAR(255),
    product_region VARCHAR(255),
    inspection_institution VARCHAR(255),
    unqualified_items LONGTEXT,
    inspection_result LONGTEXT,
    requirement LONGTEXT,
    remarks LONGTEXT,
    raw_payload LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (food_inspection_id) REFERENCES food_inspection(id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES food_inspection_attachments(id) ON DELETE SET NULL,
    INDEX idx_food_product_notice (food_inspection_id),
    INDEX idx_food_product_name (product_name),
    INDEX idx_food_product_company (company_names(191)),
    INDEX idx_food_product_issue (unqualified_items(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 抽样检查表
CREATE TABLE IF NOT EXISTS inspections (

    id INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id INT,  -- 所属公告ID
    title VARCHAR(200) NOT NULL,
    batch_number VARCHAR(100),  -- 批次号
    inspection_date DATE,
    inspection_unit VARCHAR(100),
    region VARCHAR(100),
    level ENUM('national', 'provincial', 'municipal') NOT NULL,
    total_samples INT DEFAULT 0,
    qualified_count INT DEFAULT 0,
    unqualified_count INT DEFAULT 0,
    qualified_rate DECIMAL(5,2),
    summary TEXT,
    status ENUM('published', 'archived') DEFAULT 'published',
    source VARCHAR(100),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 企业信息表
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    brand VARCHAR(100),  -- 品牌
    type ENUM('manufacturer', 'distributor', 'seller') DEFAULT 'manufacturer',
    address VARCHAR(500),
    province VARCHAR(50),
    city VARCHAR(50),
    sampled_count INT DEFAULT 0,
    last_sampled_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 企业名称沿革：批量导入信用代码且目标企业已有信用代码时写入（不覆盖原代码）
CREATE TABLE IF NOT EXISTS company_name_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name_before VARCHAR(200) NOT NULL,
    existing_credit_code VARCHAR(64) NULL,
    attempted_credit_code VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_company_name_history_company (company_id),
    CONSTRAINT fk_company_name_history_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 抽样检查详情表
CREATE TABLE IF NOT EXISTS inspection_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inspection_id INT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    company_id INT,  -- 关联企业ID
    manufacturer VARCHAR(200),
    production_date DATE,
    sample_source VARCHAR(100),
    inspection_result ENUM('qualified', 'unqualified', 'pending') DEFAULT 'pending',
    unqualified_items TEXT,
    inspection_standard LONGTEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 企业检查统计视图
CREATE OR REPLACE VIEW company_inspection_stats AS
SELECT
    c.id AS company_id,
    c.name AS company_name,
    c.brand,
    c.province,
    COUNT(DISTINCT id.inspection_id) AS inspection_count,
    COUNT(DISTINCT id.product_name) AS product_count,
    SUM(CASE WHEN id.inspection_result = 'unqualified' THEN 1 ELSE 0 END) AS unqualified_count,
    SUM(CASE WHEN id.inspection_result = 'qualified' THEN 1 ELSE 0 END) AS qualified_count,
    MAX(id.created_at) AS last_inspection_date
FROM companies c
LEFT JOIN inspection_details id ON c.id = id.company_id
GROUP BY c.id, c.name, c.brand, c.province;

-- 飞行检查通告表
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
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'flight_inspection',
    source_detail_url VARCHAR(500),
    source_page VARCHAR(500),
    source_json_file VARCHAR(500),
    content LONGTEXT,

    rectification_deadline DATE,
    status ENUM('ongoing', 'completed', 'pending_rectification') DEFAULT 'ongoing',
    source VARCHAR(100),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supervisions_company_name (company_name),
    INDEX idx_supervisions_publish_date (publish_date),
    INDEX idx_supervisions_product_type (product_type),
    INDEX idx_supervisions_announcement_type (announcement_type),
    INDEX idx_supervisions_source_detail_url (source_detail_url(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 企业抽查记录表
CREATE TABLE IF NOT EXISTS company_sampling_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    announcement_id INT NOT NULL,
    announcement_detail_id INT NOT NULL,
    product_name VARCHAR(255),
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
    sampled_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_company_sampling_detail_company (announcement_detail_id, company_id),
    INDEX idx_company_sampling_company (company_id),
    INDEX idx_company_sampling_announcement (announcement_id),
    INDEX idx_company_sampling_product_type (product_type),
    INDEX idx_company_sampling_announcement_type (announcement_type),

    CONSTRAINT fk_company_sampling_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_company_sampling_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    CONSTRAINT fk_company_sampling_detail FOREIGN KEY (announcement_detail_id) REFERENCES announcement_product_details(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 飞行检查附件表

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
    FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE,
    INDEX idx_supervision_attachments_supervision (supervision_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 飞行检查明细表
CREATE TABLE IF NOT EXISTS flight_inspection_detail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supervision_id INT NOT NULL,
    sequence_no INT NOT NULL DEFAULT 1,
    title VARCHAR(255),
    company_name VARCHAR(255),
    production_license_no VARCHAR(255),
    social_credit_code VARCHAR(255),
    company_address TEXT,
    inspection_unit VARCHAR(255),
    inspection_basis LONGTEXT,
    defects_and_problems LONGTEXT,
    handling_measures LONGTEXT,
    publish_date DATE,
    publish_date_text VARCHAR(100),
    raw_text LONGTEXT,
    attachment_name VARCHAR(255),
    attachment_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE,
    INDEX idx_flight_inspection_detail_supervision (supervision_id),
    INDEX idx_flight_inspection_detail_company_name (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 飞行检查企业关联表
CREATE TABLE IF NOT EXISTS company_supervision_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    supervision_id INT NOT NULL,
    supervision_detail_id INT NULL,
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'flight_inspection',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_company_supervision_company (supervision_id, company_id),
    INDEX idx_company_supervision_company (company_id),
    INDEX idx_company_supervision_supervision (supervision_id),
    INDEX idx_company_supervision_detail (supervision_detail_id),
    INDEX idx_company_supervision_product_type (product_type),
    INDEX idx_company_supervision_announcement_type (announcement_type),

    CONSTRAINT fk_company_supervision_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_company_supervision_supervision FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE,
    CONSTRAINT fk_company_supervision_detail FOREIGN KEY (supervision_detail_id) REFERENCES flight_inspection_detail(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 不符合规定化妆品明细表


CREATE TABLE IF NOT EXISTS unqualified_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_title VARCHAR(255) NOT NULL,
    total_batches INT DEFAULT 0,
    sequence_no INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    company_names TEXT,
    company_addresses TEXT,
    manufacturer_name VARCHAR(500),
    manufacturer_address TEXT,
    operator_name VARCHAR(500),
    operator_address TEXT,
    sample_unit_name VARCHAR(500),
    sample_unit_address TEXT,
    package_spec VARCHAR(255),
    batch_no VARCHAR(255),
    production_date VARCHAR(100),
    expiry_date VARCHAR(255),
    product_region VARCHAR(255),
    registration_no VARCHAR(255),
    production_license_no VARCHAR(255),
    inspection_institution VARCHAR(255),
    unqualified_items LONGTEXT,
    inspection_result LONGTEXT,
    requirement LONGTEXT,
    remarks LONGTEXT,
    product_category VARCHAR(100) NULL,
    manufacturer_province VARCHAR(100) NULL,
    manufacturer_city VARCHAR(100) NULL,
    sampled_province VARCHAR(100) NULL,
    sampled_city VARCHAR(100) NULL,
    issue_category VARCHAR(100) NULL,
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
    announcement_id INT NULL,
    announcement_detail_id INT NULL,
    supervision_id INT NULL,
    supervision_detail_id INT NULL,
    is_counterfeit TINYINT(1) DEFAULT 0,
    usage_user JSON NULL COMMENT '使用用户（保存文案时追加 JSON 记录：username/display_name/saved_at）',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_unqualified_products_batch_sequence (batch_title, sequence_no),
    INDEX idx_unqualified_products_product_name (product_name),
    INDEX idx_unqualified_products_manufacturer_name (manufacturer_name),
    INDEX idx_unqualified_products_operator_name (operator_name),
    INDEX idx_unqualified_products_sample_unit_name (sample_unit_name),
    INDEX idx_unqualified_products_inspection_institution (inspection_institution),
    INDEX idx_unqualified_products_product_region (product_region),
    INDEX idx_unqualified_products_product_category (product_category),
    INDEX idx_unqualified_products_manufacturer_province (manufacturer_province),
    INDEX idx_unqualified_products_manufacturer_city (manufacturer_city),
    INDEX idx_unqualified_products_sampled_province (sampled_province),
    INDEX idx_unqualified_products_sampled_city (sampled_city),
    INDEX idx_unqualified_products_issue_category (issue_category),
    INDEX idx_unqualified_products_announcement (announcement_id),
    INDEX idx_unqualified_products_announcement_detail (announcement_detail_id),
    INDEX idx_unqualified_products_supervision (supervision_id),
    INDEX idx_unqualified_products_supervision_detail (supervision_detail_id),
    INDEX idx_unqualified_products_counterfeit (is_counterfeit),
    CONSTRAINT fk_unqualified_products_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    CONSTRAINT fk_unqualified_products_announcement_detail FOREIGN KEY (announcement_detail_id) REFERENCES announcement_product_details(id) ON DELETE CASCADE,
    CONSTRAINT fk_unqualified_products_supervision FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE,
    CONSTRAINT fk_unqualified_products_supervision_detail FOREIGN KEY (supervision_detail_id) REFERENCES flight_inspection_detail(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




CREATE TABLE IF NOT EXISTS unqualified_product_category_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unqualified_product_id INT NOT NULL,
    announcement_id INT NULL,
    announcement_detail_id INT NULL,
    product_category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_unqualified_product_category_item (unqualified_product_id, product_category),
    INDEX idx_upci_product_category (product_category),
    INDEX idx_upci_product (unqualified_product_id),
    INDEX idx_upci_announcement (announcement_id),
    INDEX idx_upci_announcement_detail (announcement_detail_id),
    CONSTRAINT fk_upci_unqualified_product FOREIGN KEY (unqualified_product_id) REFERENCES unqualified_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 数据管理员维护：按产品类型维度的产品分类词条（从拆分表与主表回填，可独立增删）
CREATE TABLE IF NOT EXISTS unqualified_product_category_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    category_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_upccc_type_category (product_type, category_name),
    INDEX idx_upccc_product_type (product_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分类管理页：手动扩充的产品类型
CREATE TABLE IF NOT EXISTS unqualified_product_type_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_type VARCHAR(50) NOT NULL,
    display_label VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_uptc_product_type (product_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS unqualified_product_issue_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unqualified_product_id INT NOT NULL,
    announcement_id INT NULL,
    announcement_detail_id INT NULL,
    issue_item VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_unqualified_product_issue_item (unqualified_product_id, issue_item),
    INDEX idx_upii_issue_item (issue_item),
    INDEX idx_upii_product (unqualified_product_id),
    INDEX idx_upii_announcement (announcement_id),
    INDEX idx_upii_announcement_detail (announcement_detail_id),
    CONSTRAINT fk_upii_unqualified_product FOREIGN KEY (unqualified_product_id) REFERENCES unqualified_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 不合格产品页：用户保存的口播/文案记录
CREATE TABLE IF NOT EXISTS unqualified_product_copy_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(191) NOT NULL DEFAULT '',
    display_name VARCHAR(255) NULL,
    copy_text LONGTEXT NOT NULL,
    product_ids JSON NOT NULL,
    dimension_label VARCHAR(512) NULL,
    range_label VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_upcr_user_id (user_id),
    INDEX idx_upcr_created_at (created_at),
    CONSTRAINT fk_upcr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 不合格产品页：产品被用户使用的累计记录（一产品一用户一行）
CREATE TABLE IF NOT EXISTS unqualified_product_usage_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unqualified_product_id INT NOT NULL,
    user_id INT NULL,
    username VARCHAR(191) NOT NULL DEFAULT '',
    display_name VARCHAR(255) NULL,
    use_count INT NOT NULL DEFAULT 0,
    first_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_upur_product_username (unqualified_product_id, username),
    INDEX idx_upur_product_last_used (unqualified_product_id, last_used_at),
    INDEX idx_upur_user_id (user_id),
    CONSTRAINT fk_upur_unqualified_product FOREIGN KEY (unqualified_product_id) REFERENCES unqualified_products(id) ON DELETE CASCADE,
    CONSTRAINT fk_upur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO unqualified_products (

    batch_title, total_batches, sequence_no, product_name, company_names, company_addresses,
    sample_unit_name, sample_unit_address, package_spec, batch_no, production_date, expiry_date,
    product_region, registration_no, production_license_no, inspection_institution,
    unqualified_items, inspection_result, requirement, remarks
) VALUES
(
    '40批次不符合规定化妆品信息', 40, 1, 'Orginese祛痘净肤水光面膜', '中幸（广州）化妆品股份有限公司', '广州市花都区红棉大道北48号7栋101厂房',
    '长沙久烁电子商务有限公司，网店商铺名称：京东欧橘ORGINESE旗舰店', '湖南省长沙市雨花区汇金路877号嘉华智谷产业园Q1、A2、A3栋1606房', '25ml×10片', 'ZPC0311', '/', '20280302',
    '广东', '粤G妆网备字2023468030', '粤妆20160344', '浙江省食品药品检验研究院',
    '菌落总数', '14000CFU/g', '≤1000CFU/g', '/'
),
(
    '40批次不符合规定化妆品信息', 40, 2, '舒晨云南三七草本清吙护龈牙膏双重薄荷香型', '佛山市珠光生物科技有限公司', '佛山市南海区大沥镇黄岐泌冲村“烟斗岗泌冲路99号D座首层（住所申报）',
    '霍山县大沙埂如海超市', '安徽省六安市霍山县与儿街镇大沙埂村大别山农博城2#1F、2F', '180g', '24031001', '/', '20270309',
    '广东', '粤国牙膏网备字2023404589', '粤妆20220035', '安徽省食品药品检验研究院',
    '菌落总数', '7.9×104CFU/g', '≤500CFU/g', '/'
)
ON DUPLICATE KEY UPDATE
    total_batches = VALUES(total_batches),
    product_name = VALUES(product_name),
    company_names = VALUES(company_names),
    company_addresses = VALUES(company_addresses),
    sample_unit_name = VALUES(sample_unit_name),
    sample_unit_address = VALUES(sample_unit_address),
    package_spec = VALUES(package_spec),
    batch_no = VALUES(batch_no),
    production_date = VALUES(production_date),
    expiry_date = VALUES(expiry_date),
    product_region = VALUES(product_region),
    registration_no = VALUES(registration_no),
    production_license_no = VALUES(production_license_no),
    inspection_institution = VALUES(inspection_institution),
    unqualified_items = VALUES(unqualified_items),
    inspection_result = VALUES(inspection_result),
    requirement = VALUES(requirement),
    remarks = VALUES(remarks);

-- 公告临时导入批次表（爬虫 JSON 待确认区）
CREATE TABLE IF NOT EXISTS announcement_staging_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_sequence INT NULL,
    source_json_file VARCHAR(500) NOT NULL,
    source_detail_url VARCHAR(500) NULL,
    source_page VARCHAR(500) NULL,
    title VARCHAR(255) NOT NULL,
    announcement_no VARCHAR(100) NULL,
    publish_date DATE NULL,
    content LONGTEXT,
    inspection_unit VARCHAR(500),
    inspection_count INT DEFAULT 0,
    attachment_count INT DEFAULT 0,
    parsed_detail_count INT DEFAULT 0,
    counterfeit_count INT DEFAULT 0,
    primary_attachment_name VARCHAR(255),
    primary_attachment_path VARCHAR(1000),
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
    raw_payload LONGTEXT,
    status ENUM('pending', 'confirmed') DEFAULT 'pending',
    published_announcement_id INT NULL,
    published_supervision_id INT NULL,
    imported_by_user_id INT NULL,
    imported_by_username VARCHAR(50) NULL,
    imported_at DATETIME NULL,
    import_source VARCHAR(50) NOT NULL DEFAULT 'server_directory',
    source_file_name VARCHAR(255) NULL,
    source_relative_path VARCHAR(500) NULL,
    confirmed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_staging_source_json_file (source_json_file),
    INDEX idx_staging_status_publish_date (status, publish_date),
    INDEX idx_staging_announcement_no (announcement_no),
    INDEX idx_staging_product_type (product_type),
    INDEX idx_staging_announcement_type (announcement_type),
    INDEX idx_staging_published_announcement (published_announcement_id),
    INDEX idx_staging_published_supervision (published_supervision_id),
    CONSTRAINT fk_staging_published_announcement FOREIGN KEY (published_announcement_id) REFERENCES announcements(id) ON DELETE SET NULL,
    CONSTRAINT fk_staging_published_supervision FOREIGN KEY (published_supervision_id) REFERENCES supervisions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告临时导入产品明细表
CREATE TABLE IF NOT EXISTS announcement_staging_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staging_batch_id INT NOT NULL,
    sequence_no INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    company_names TEXT,
    company_addresses TEXT,
    manufacturer_name VARCHAR(500),
    manufacturer_address TEXT,
    operator_name VARCHAR(500),
    operator_address TEXT,
    sample_unit_name VARCHAR(500),
    sample_unit_address TEXT,
    package_spec VARCHAR(255),
    batch_no VARCHAR(255),
    production_date VARCHAR(100),
    expiry_date VARCHAR(255),
    product_region VARCHAR(255),
    registration_no VARCHAR(255),
    production_license_no VARCHAR(255),
    inspection_institution VARCHAR(255),
    unqualified_items LONGTEXT,
    inspection_result LONGTEXT,
    requirement LONGTEXT,
    remarks LONGTEXT,
    is_counterfeit TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_staging_item_batch_sequence (staging_batch_id, sequence_no),
    INDEX idx_staging_item_product (product_name),
    INDEX idx_staging_item_counterfeit (is_counterfeit),
    CONSTRAINT fk_staging_item_batch FOREIGN KEY (staging_batch_id) REFERENCES announcement_staging_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告正式发布备用快照表
CREATE TABLE IF NOT EXISTS announcement_publish_backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staging_batch_id INT NOT NULL,
    announcement_id INT NULL,
    supervision_id INT NULL,
    title VARCHAR(255) NOT NULL,
    announcement_no VARCHAR(100),
    publish_date DATE NULL,
    inspection_unit VARCHAR(500),
    inspection_count INT DEFAULT 0,
    detail_count INT DEFAULT 0,
    primary_attachment_name VARCHAR(255),
    primary_attachment_path VARCHAR(1000),
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
    payload_json LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_publish_backup_stage (staging_batch_id),
    INDEX idx_publish_backup_announcement (announcement_id),
    INDEX idx_publish_backup_supervision (supervision_id),
    CONSTRAINT fk_publish_backup_stage FOREIGN KEY (staging_batch_id) REFERENCES announcement_staging_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_publish_backup_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    CONSTRAINT fk_publish_backup_supervision FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告导入倒溯记录表
CREATE TABLE IF NOT EXISTS announcement_staging_tracebacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trace_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    announcement_no VARCHAR(100) NULL,
    source_json_file VARCHAR(500) NOT NULL,
    source_detail_url VARCHAR(500) NULL,
    source_page VARCHAR(500) NULL,
    product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
    announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
    reason VARCHAR(500) NOT NULL,
    attachment_summary_json LONGTEXT NULL,
    raw_payload LONGTEXT NULL,
    existing_batch_id INT NULL,
    existing_announcement_id INT NULL,
    existing_supervision_id INT NULL,
    imported_by_user_id INT NULL,
    imported_by_username VARCHAR(50) NULL,
    imported_at DATETIME NULL,
    import_source VARCHAR(50) NOT NULL DEFAULT 'server_directory',
    source_file_name VARCHAR(255) NULL,
    source_relative_path VARCHAR(500) NULL,
    handled_status ENUM('pending', 'resolved') DEFAULT 'pending',
    handled_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tracebacks_status_type (handled_status, trace_type),
    INDEX idx_tracebacks_existing_batch (existing_batch_id),
    INDEX idx_tracebacks_source_json_file (source_json_file(191)),
    INDEX idx_tracebacks_source_detail_url (source_detail_url(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (

    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50),
    record_id INT,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 不合格产品页：层级方案标题（命名 + 维度顺序）与用户关联（同一用户多套方案）
CREATE TABLE IF NOT EXISTS unqualified_dimension_preset_titles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL COMMENT '方案命名',
    dimension_order_json JSON NOT NULL COMMENT '层级字段顺序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_udpt_creator (creator_user_id),
    CONSTRAINT fk_udpt_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_unqualified_dimension_preset_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    preset_title_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_u_udpm_user_preset (user_id, preset_title_id),
    INDEX idx_u_udpm_user (user_id),
    CONSTRAINT fk_u_udpm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_u_udpm_preset FOREIGN KEY (preset_title_id) REFERENCES unqualified_dimension_preset_titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认用户（后端首次登录会将历史明文密码自动升级为带盐哈希）
INSERT IGNORE INTO users (username, email, password, display_name, role, status) VALUES
('admin', 'admin@cosmetics.com', 'admin', '系统管理员', 'developer', 'active'),
('data_admin', 'data_admin@cosmetics.com', 'data_admin', '数据管理员', 'data_admin', 'active'),
('user', 'user@cosmetics.com', 'user', '普通用户', 'normal_user', 'active');
