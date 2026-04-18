-- 化妆品资讯系统数据库结构
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

-- 政策分类表
CREATE TABLE IF NOT EXISTS policy_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 政策信息表
CREATE TABLE IF NOT EXISTS policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT,
    category_id INT,
    level ENUM('national', 'provincial', 'municipal') NOT NULL,
    publish_date DATE,
    effective_date DATE,
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    source VARCHAR(100),
    author_id INT,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES policy_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 标准分类表
CREATE TABLE IF NOT EXISTS standard_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 标准信息表
CREATE TABLE IF NOT EXISTS standards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT,
    category_id INT,
    type ENUM('national', 'industry', 'local') NOT NULL,
    publish_date DATE,
    effective_date DATE,
    obsolete_date DATE,
    status ENUM('valid', 'revised', 'obsolete') DEFAULT 'valid',
    source VARCHAR(100),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES standard_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 抽样检查表
CREATE TABLE IF NOT EXISTS inspections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    batch_number VARCHAR(100),
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 抽样检查详情表
CREATE TABLE IF NOT EXISTS inspection_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inspection_id INT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    manufacturer VARCHAR(200),
    production_date DATE,
    sample_source VARCHAR(100),
    inspection_result ENUM('qualified', 'unqualified', 'pending') DEFAULT 'pending',
    unqualified_items TEXT,
    inspection_standard LONGTEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- 通知公告表
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT,
    type ENUM('general', 'urgent', 'system') DEFAULT 'general',
    publish_date DATE,
    expiry_date DATE,
    is_top BOOLEAN DEFAULT FALSE,
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    author_id INT,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
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

-- 插入默认分类数据
INSERT INTO policy_categories (name, description) VALUES
('法律法规', '化妆品相关法律法规'),
('部门规章', '各部门发布的规章文件'),
('规范性文件', '各类规范性文件'),
('政策解读', '政策解读文件');

INSERT INTO standard_categories (name, description) VALUES
('安全标准', '化妆品安全标准'),
('卫生标准', '化妆品卫生标准'),
('检测方法', '化妆品检测方法标准'),
('标签标识', '化妆品标签标识标准');

-- 插入默认管理员用户（密码需要加密，这里为示例）
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@cosmetics.com', '$2b$10$placeholder_hash_password_here', 'admin');
