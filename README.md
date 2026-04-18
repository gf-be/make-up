# 化妆品资讯系统

一个基于 Vue3 + Element Plus + Node.js + Express + MySQL 的化妆品资讯管理系统，1.实现https://www.nmpa.gov.cn/hzhp/hzhpcjgg/index.html 化妆品抽检通告及其详细信息包括序号、标示产品名称、标示化妆品注册人/备案人、受托生产企业、境内责任人（经销商）等名称、被抽样单位名称、被抽样单位地址、包装规格、标示批号、标示生产日期、标示限期使用日期/保质期、标示化妆品注册人/备案人、受托生产企业、境内责任人（经销商）所在地/产品进口地区、特殊化妆品注册证编号/普通化妆品备案编号、标示生产许可证号、检验机构名称、不符合规定项目、检验结果、规定要求、备注等信息的展示。通告内附件内容的表格展示、数据筛选功能。比如能够根据不符合规定项目进行筛选查看有哪些企业存在不合格情况。2.https://www.nmpa.gov.cn/xxgk/fxjzh/hzhpfxjch/index.html 实现化妆品飞行检查通告列表及其详细信息包括企业名称、化妆品生产许可证编号、企业地址、检查单位、检查依据、检查发现缺陷和问题、处理措施、发布日期的表格展示

## 系统功能

### 核心功能模块

1. **抽样检查**
   - 各级别抽样检查结果
   - 合格率统计
   - 检查详情展示
   - 数据筛选和搜索

2. **导入检查**
   - 临时区管理
   - 导入内容人工审核
   - 导入结果展示
   - 导入进度展示

3. **倒溯处理**
   - 导入过程错误记录
   - 错误记录删除

4. **抽检通告**
   - 通告列表展示
   - 通告详情展示
   - 多维数据筛选和搜索，包括时间、地点、产品类型等

5. **不合格企业**
   - 企业列表展示
   - 企业详情展示
   - 多维数据筛选和搜索，包括涉及到的时间、地点、产品类型，涉及哪条通告下的哪个产品
6. **不合格产品**
   - 产品列表展示
   - 对于产品模糊筛选后，比如选择产品类型为化妆品，搜索面膜能检索产品名称包含面膜的不合格产品，并显示产品所在省份，产品抽检次数等统计数据
   - 多维数据筛选和搜索，包括涉及到的时间、地点、产品类型，涉及哪条通告下的哪个公司的哪个产品
## 技术栈

### 前端
- Vue 3.3
- Element Plus 2.4
- Vue Router 4.2
- Axios 1.5
- ECharts 5.4
- Vite 4.5

### 后端
- Node.js
- Express 4.18
- MySQL 8.0
- mysql2 3.6
- CORS

## 项目结构

```
化妆品/
├── database/              # 数据库文件
│   └── schema.sql        # 数据库表结构
├── backend/              # 后端服务
│   ├── config/           # 配置文件
│   │   └── database.js   # 数据库配置
│   ├── routes/           # 路由文件
│   │   ├── policies.js   # 政策路由
│   │   ├── standards.js  # 标准路由
│   │   ├── inspections.js # 检查路由
│   │   ├── supervisions.js # 督查路由
│   │   ├── announcements.js # 公告路由
│   │   └── dashboard.js  # 仪表板路由
│   ├── .env.example      # 环境变量示例
│   ├── package.json      # 依赖配置
│   └── server.js         # 服务器入口
└── frontend/             # 前端应用
    ├── src/
    │   ├── api/          # API接口
    │   │   └── index.js
    │   ├── router/       # 路由配置
    │   │   └── index.js
    │   ├── utils/        # 工具函数
    │   │   └── request.js
    │   ├── views/        # 页面组件
    │   │   ├── Dashboard.vue
    │   │   ├── Policies.vue
    │   │   ├── PolicyDetail.vue
    │   │   ├── Standards.vue
    │   │   ├── StandardDetail.vue
    │   │   ├── Inspections.vue
    │   │   ├── InspectionDetail.vue
    │   │   ├── Supervisions.vue
    │   │   └── SupervisionDetail.vue
    │   ├── App.vue       # 根组件
    │   └── main.js       # 入口文件
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 快速开始

### 环境要求

- Node.js 16+
- MySQL 8.0+
- npm 或 yarn

### 1. 数据库配置

```bash
# 登录MySQL
mysql -u root -p

# 执行数据库脚本
source f:/daoke/化妆品/database/schema.sql
```

### 2. 后端配置

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库信息

# 启动后端服务
npm run dev
```

后端服务将运行在 http://localhost:3000

### 3. 前端配置

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动前端服务
npm run dev
```

前端服务将运行在 http://localhost:5173

## 数据库表说明

### 核心表结构

1. **users** - 用户表
2. **policies** - 政策信息表
3. **policy_categories** - 政策分类表
4. **standards** - 标准信息表
5. **standard_categories** - 标准分类表
6. **inspections** - 抽样检查表
7. **inspection_details** - 检查详情表
8. **supervisions** - 督查结果表
9. **announcements** - 通知公告表
10. **operation_logs** - 操作日志表

## API 接口说明

### 基础路径
所有接口基础路径为: `/api`

### 主要接口


**抽样检查**
- `GET /inspections` - 获取检查列表
- `GET /inspections/:id` - 获取检查详情
- `GET /inspections/stats/overview` - 获取统计数据

**督查**
- `GET /supervisions` - 获取督查列表
- `GET /supervisions/:id` - 获取督查详情
- `GET /supervisions/stats/overview` - 获取统计数据

## 系统特点

1. **清晰的界面设计**
   - 采用现代化的 Element Plus 组件库
   - 响应式布局，适配不同屏幕
   - 统一的设计风格

2. **完善的筛选功能**
   - 多维度筛选条件
   - 关键词搜索
   - 分页展示

3. **数据可视化**
   - ECharts 图表展示
   - 实时统计更新
   - 趋势分析

4. **易于扩展**
   - 模块化设计
   - 清晰的代码结构
   - 完善的 API 接口

## 后续可扩展功能

1. 用户认证和权限管理
2. 数据导入导出
3. 消息通知系统
4. 数据报表生成
5. 数据分析功能
6. 移动端适配
7. 多语言支持
8. 数据备份恢复

## 开发说明

### 添加新功能

1. 在 `database/schema.sql` 中添加数据表
2. 在 `backend/routes/` 中创建对应的路由文件
3. 在 `frontend/src/views/` 中创建页面组件
4. 在 `frontend/src/api/index.js` 中添加 API 方法
5. 在 `frontend/src/router/index.js` 中添加路由配置

### 数据库操作

使用 `mysql2` 进行数据库操作，支持 Promise 和 async/await。

## 许可证

MIT

## 联系方式

如有问题或建议，请联系开发团队。
