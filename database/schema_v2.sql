-- 化妆品资讯系统数据库结构 v2
CREATE DATABASE IF NOT EXISTS cosmetics_info DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cosmetics_info;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
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
    inspection_count INT DEFAULT 0,  -- 抽检批次总数（自动提取）
    attachment_path VARCHAR(500),  -- 附件路径
    attachment_name VARCHAR(200),  -- 附件原名
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    author_id INT,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告批次不符合规定化妆品明细表
CREATE TABLE IF NOT EXISTS announcement_product_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id INT NOT NULL,
    sequence_no INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    company_names TEXT,
    company_addresses TEXT,
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
    inspection_standard VARCHAR(100),
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
    content LONGTEXT,
    rectification_deadline DATE,
    status ENUM('ongoing', 'completed', 'pending_rectification') DEFAULT 'ongoing',
    source VARCHAR(100),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supervisions_company_name (company_name),
    INDEX idx_supervisions_publish_date (publish_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 企业抽查记录表
CREATE TABLE IF NOT EXISTS company_sampling_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    announcement_id INT NOT NULL,
    announcement_detail_id INT NOT NULL,
    product_name VARCHAR(255),
    sampled_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_company_sampling_detail_company (announcement_detail_id, company_id),
    INDEX idx_company_sampling_company (company_id),
    INDEX idx_company_sampling_announcement (announcement_id)
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

-- 不符合规定化妆品明细表

CREATE TABLE IF NOT EXISTS unqualified_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_title VARCHAR(255) NOT NULL,
    total_batches INT DEFAULT 0,
    sequence_no INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    company_names TEXT,
    company_addresses TEXT,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_unqualified_products_batch_sequence (batch_title, sequence_no),
    INDEX idx_unqualified_products_product_name (product_name),
    INDEX idx_unqualified_products_sample_unit_name (sample_unit_name),
    INDEX idx_unqualified_products_inspection_institution (inspection_institution)
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

-- 插入默认管理员用户（密码需要加密，这里为示例）
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@cosmetics.com', '$2b$10$placeholder_hash_password_here', 'admin');
