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

-- 督查结果表
CREATE TABLE IF NOT EXISTS supervisions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    supervision_date DATE,
    supervision_unit VARCHAR(100),
    region VARCHAR(100),
    level ENUM('national', 'provincial', 'municipal') NOT NULL,
    supervision_type VARCHAR(50),
    content TEXT,
    rectification_deadline DATE,
    status ENUM('ongoing', 'completed', 'pending_rectification') DEFAULT 'ongoing',
    source VARCHAR(100),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

-- 插入默认管理员用户（密码需要加密，这里为示例）
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@cosmetics.com', '$2b$10$placeholder_hash_password_here', 'admin');
