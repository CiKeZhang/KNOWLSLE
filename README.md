# 高校学院考研进度管控与智能辅导系统

> 面向高校学院的考研全流程管理平台，微信小程序 + Node.js 后端，覆盖学生端与导师端。

## 项目简介

本系统解决考研管理中**学生进度不可见、导师辅导缺数据、学院统计靠人工**的痛点，实现：

- 学生周度打卡、进度档案、AI 院校推荐、学习计划、帮扶申请

- 导师看板（按专业统计打卡率/阶段分布/上岸率）、学生管理、预警中心、帮扶对接

- 5 个专业：信息管理、电子商务、财务管理、经济学、市场营销

## 技术栈

| 层级  | 技术                                 |
| --- | ---------------------------------- |
| 前端  | 微信小程序原生（WXML/WXSS/JS），16 个页面       |
| 后端  | Node.js + NestJS，86 个 API          |
| 数据库 | Prisma ORM + SQLite（开发）/ MySQL（生产） |
| 认证  | 微信登录 + JWT                         |

## 目录结构

```
.
├── backend/          # NestJS 后端
│   ├── src/          # 各业务模块（auth/mentor/checkin/ai 等）
│   └── prisma/       # 数据库 Schema
├── miniprogram/      # 微信小程序前端
│   ├── pages/        # 页面
│   ├── app.js/json   # 小程序入口
│   └── config.js     # API 地址、专业列表
├── docs/             # 文档
└── 项目介绍文档.md
```

## 快速开始

### 后端

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

### 小程序

1. 微信开发者工具打开 `miniprogram/` 目录
2. 修改 `config.js` 中的 `apiBase` 为后端地址
3. 真机调试需用电脑局域网 IP（运行 `bash update-ip.sh` 自动更新）

### 预置账号

| 姓名  | 工号   | 角色    | 管辖   |
| --- | ---- | ----- | ---- |
| 王院长 | A001 | 学院管理员 | 全院   |
| 李老师 | T101 | 专业导师  | 信息管理 |
| 赵老师 | T201 | 专业导师  | 电子商务 |
| 陈老师 | T301 | 专业导师  | 财务管理 |
| 刘老师 | T401 | 专业导师  | 经济学  |
| 周老师 | T501 | 专业导师  | 市场营销 |

## 注意事项

- `backend/.env` 包含微信 AppID/Secret、JWT 密钥等敏感信息，**不要提交到 GitHub**（已在 .gitignore 中排除）

- 团队成员克隆后需自行配置 `.env` 文件

- 数据库文件 `dev.db` 也不会被提交

## 协作规范

- 开发新功能前请先创建分支：`git checkout -b feature/xxx`

- 提交前确保代码可编译运行

- Pull Request 需至少一人审核后合并

