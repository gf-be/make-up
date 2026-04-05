const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务（用于上传的附件）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api/policies', require('./routes/policies'));
app.use('/api/standards', require('./routes/standards'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/supervisions', require('./routes/supervisions'));
app.use('/api/announcements', require('./routes/announcements_upload'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '化妆品资讯系统API运行正常' });
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    name: '化妆品资讯系统 API',
    version: '1.0.0',
    endpoints: {
      policies: '/api/policies',
      standards: '/api/standards',
      inspections: '/api/inspections',
      supervisions: '/api/supervisions',
      announcements: '/api/announcements',
      dashboard: '/api/dashboard'
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`化妆品资讯系统API服务器运行在端口 ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 查看API文档`);
});

module.exports = app;
