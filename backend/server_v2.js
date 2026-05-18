const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// 中间件
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((item) => item.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';

function matchConfiguredOrigin(origin) {
  return allowedOrigins.some((pattern) => {
    if (pattern === origin) return true;
    if (!pattern.includes('*')) return false;

    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(origin);
  });
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);
    const isCloudflareTunnel = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(normalizedOrigin);
    const isConfigured = matchConfiguredOrigin(normalizedOrigin);

    if (allowAllOrigins || isLocalhost || isCloudflareTunnel || isConfigured) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务（multer 等上传目录）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// public 目录：本地产品配图放 public/upload/products/，浏览器访问 /upload/products/文件名
const publicDir = path.join(__dirname, 'public');
try {
  fs.mkdirSync(path.join(publicDir, 'upload', 'products'), { recursive: true });
} catch (e) {
  console.warn('[static] ensure public/upload/products:', e.message);
}
app.use(express.static(publicDir));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/announcements', require('./routes/announcements_v2'));
app.use('/api/announcement-staging', require('./routes/announcement_staging'));
app.use('/api/inspections', require('./routes/inspections_v2'));
app.use('/api/companies', require('./routes/companies'));
// app.use('/api/companies-manage', require('./routes/companies_manage'));
app.use('/api/unqualified-products', require('./routes/unqualified_products'));
app.use('/api/category-catalog', require('./routes/category_catalog'));
app.use('/api/supervisions', require('./routes/supervisions'));
app.use('/api/food-inspections', require('./routes/food_inspections'));



// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '化妆品资讯系统API运行正常' });
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    name: '化妆品资讯系统 API v2',
    version: '2.0.0',
    description: '专注于抽样检查和企业管理的化妆品资讯系统',
    endpoints: {
      announcements: '/api/announcements',
      auth: '/api/auth',
      announcementStaging: '/api/announcement-staging',
      inspections: '/api/inspections',
      companies: '/api/companies',
      companiesManage: '/api/companies-manage',
      unqualifiedProducts: '/api/unqualified-products',
      categoryCatalog: '/api/category-catalog',
      supervisions: '/api/supervisions',
      foodInspections: '/api/food-inspections'
    }

  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ success: false, message: '请求的资源不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

const PORT = Number(process.env.PORT) || 3003;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`化妆品资讯系统API服务器运行在 ${HOST}:${PORT}`);
  console.log(`本机访问: http://localhost:${PORT}`);
});

module.exports = app;
