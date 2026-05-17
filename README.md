# Black Bean Sprouts（黑豆芽）

医学/学术文档 Agent 编辑平台 — 前端开发接入指南

---

## 项目简介

黑豆芽是一个 AI 驱动的医学/学术文档编辑平台，帮助用户将未结构化的原始文稿（纯文本 / DOCX）通过 AI 自动整理成结构化的专业文档，并导出为 DOCX 或 LaTeX 格式。

核心流程：

```
原始文稿 → AI 结构化生成 → 结构化编辑器 → 导出 DOCX / LaTeX
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
|  monorepo 管理 | pnpm workspaces |
|  前端框架 | Vue 3.5+ (Composition API) |
|  构建工具 | Vite 6+ |
|  状态管理 | Pinia 2.2+ |
|  路由 | Vue Router 4.4+ |
|  富文本编辑器 | Tiptap / ProseMirror 2.10+ |
|  后端框架 | Fastify 5+ |
|  数据库 | PostgreSQL 16 + Prisma 6+ |
|  缓存/队列 | Redis 7 + BullMQ 5 |
|  对象存储 | MinIO |

---

## 目录结构

```
black-bean-sprouts/
├── packages/
│   ├── web/                    # Vue 3 前端（你主要工作的地方）
│   ├── server/                 # Fastify 后端 API
│   ├── doc-engine/             # DOCX / LaTeX 渲染引擎
│   ├── doc-schema/             # 文档 AST 类型定义 & Patch 系统
│   ├── agent-runtime/          # AI 工具注册表
│   └── xiaolongxia-kernel/     # AI 内核运行时
├── prisma/
│   └── schema.prisma           # 数据库模型定义
├── docs/
│   ├── FRONTEND_API_HANDOFF.md      # 前端 API 接入详细文档
│   ├── FRONTEND_BILLING_HANDOFF.md  # 支付/订阅前端接入文档
│   └── RUN_WORKBENCH.md             # 工作台启动与配置指南
├── docker-compose.yml          # Postgres + Redis + MinIO
└── package.json                # 根 package.json
```

---

## 环境准备

### 前置要求

- **Node.js** >= 20.0.0（推荐 22+）
- **Corepack**（Node 自带；本仓库通过 `packageManager` 固定 pnpm）
- Docker 只用于可选的本地 Postgres / Redis / MinIO，不是 AI/Claude 开发链路的必需项。

### 1. 首次本地初始化

```bash
corepack enable
npm run setup:local
```

这个脚本会自动完成：

- 按锁文件安装 workspace 依赖。
- 把 Prisma engine cache 限制在仓库 `.tmp/` 下。
- 把 Claude Code npm 程序安装到仓库 `.claude-runtime/` 下。
- 把 Word/DOCX MCP server 安装到仓库 `.claude-runtime/mcp/` 下。
- 生成 Prisma client。

不会写入系统级 Claude 配置，也不会修改全局 npm/pnpm 配置。

### 2. 配置 AI API

```bash
cp .env.example .env
```

编辑 `.env`，至少填一个临时或正式的 DeepSeek / Anthropic-compatible key：

```bash
AI_KERNEL_PROVIDER=claude-code
WORKBENCH_PROMPT_PROVIDER=claude-code
CLAUDE_CODE_BASE_URL=https://api.deepseek.com/anthropic
CLAUDE_CODE_MODEL=deepseek-v4-pro[1m]
CLAUDE_CODE_HAIKU_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

### 3. 可选本地基础设施

如果要使用真实数据库、异步渲染队列和对象存储，可自行启动 Postgres / Redis / MinIO 并执行：

```bash
pnpm db:push
```

不需要这些基础设施时，工作台和大部分 smoke 仍可用于前端/AI 链路开发。

### Word MCP 工具

仓库包含项目级 `.mcp.json`，会把 Claude Code 连接到本地 DOCX MCP server：

```bash
npm run setup:docx-mcp
```

MCP 包安装在 `.claude-runtime/mcp/`，输出建议写到 `.tmp/docx-mcp-output/`。这两个目录都在仓库内且被 gitignore，不会影响系统级 Claude 配置。

本地 Claude 链路的踩坑记录、端口残留处理、进度排查和提交前检查见 `docs/LOCAL_CLAUDE_DEV_NOTES.md`。

---

## 启动开发服务器

### 方式一：跨平台一键脚本（推荐）

```bash
# Windows / Linux / macOS
npm run workbench:start

# 查看状态
npm run workbench:status

# 停止
npm run workbench:stop
```

这个脚本由 Node.js 实现，不依赖 PowerShell。它会同时启动：

- 后端：`http://localhost:3000/api`
- 前端：`http://localhost:5173/workbench`
- 日志：`.tmp/workbench-dev/logs/`

Windows 用户也可以继续使用兼容包装：

```powershell
.\start-workbench.ps1
.\status-workbench.ps1
.\stop-workbench.ps1
```

### 方式二：手动启动（备选）

```bash
# 终端 1：启动后端
pnpm --filter @black-bean-sprouts/server dev

# 终端 2：启动前端
pnpm --filter @black-bean-sprouts/web dev
```

### 访问地址

- 前端页面：`http://localhost:5173/workbench`
- 后端 API：`http://localhost:3000/api`
- 生产模式入口：`http://localhost:3000/workbench`（后端托管静态资源）

---

## 前端开发指南

### API 客户端

前端已封装好 API 请求工具，位于：

```
packages/web/src/lib/api.ts
```

核心函数：

```typescript
import { apiFetch, setApiToken, clearApiToken } from "@/lib/api";

// 发起 API 请求（自动携带 JWT Token）
const data = await apiFetch<YourType>("/workbench/style-profiles");

// 登录后存储 token
setApiToken("jwt-token-string");

// 退出登录
clearApiToken();
```

特点：
- 自动从 `localStorage` 读取/存储 JWT Token
- 自动添加 `Authorization: Bearer <token>` 请求头
- 自动解析 JSON 错误响应并抛出友好错误信息

### 核心接入链路（优先实现）

如果你是新接入的前端开发者，请按以下顺序接入接口：

```
login → style-profiles → import → generate → export
```

| 步骤 | 接口 | 说明 |
|------|------|------|
| 1 | `POST /api/auth/login` | 开发态登录，获取 JWT |
| 2 | `GET /api/workbench/style-profiles` | 获取排版预设列表 |
| 3 | `POST /api/workbench/import` | 导入原始文本/DOCX |
| 4 | `POST /api/workbench/generate` | AI 结构化生成文档 |
| 5 | `POST /api/workbench/export` | 导出 DOCX / LaTeX |

### 前端路由

```
/              → 重定向到 /workbench
/workbench     → 主工作台（核心页面）
/editor/:id    → 结构化文档编辑器
/admin         → 管理后台
```

路由配置：`packages/web/src/router/index.ts`

### 状态管理

使用 Pinia，当前定义了：

```
packages/web/src/stores/document.ts   # 文档状态管理
```

### 核心数据结构：Doc AST

Workbench 生成结果、编辑器数据、导出输入，统一使用 `Doc` AST：

```typescript
interface Doc {
  version: number;
  metadata: {
    title: string;
    subtitle?: string;
    institution?: string;
    keywords?: string[];
    authors?: Array<{ name: string; affiliation?: string }>;
  };
  children: BlockNode[];
}
```

支持的块级节点：`paragraph` | `heading` | `figure` | `table` | `formula` | `reference-list` | `abstract` | `section`

支持的行内节点：`text` | `hardBreak` | `citation` | `xref` | `formula-inline`

类型定义源码：`packages/doc-schema/src/doc/types.ts`

---

## API 接口速查

### Workbench 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/workbench/style-profiles` | 获取排版预设 |
| POST | `/api/workbench/import` | 导入原始文件（文本/DOCX） |
| POST | `/api/workbench/generate` | AI 结构化生成文档 |
| POST | `/api/workbench/export` | 导出文档（返回二进制文件） |

### 文档接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/documents` | 列表 |
| GET | `/api/documents/:id` | 获取文档 |
| PATCH | `/api/documents/:id/patches` | 提交 Patch 修改 |
| POST | `/api/documents/:id/render` | 触发异步渲染 |

### Agent 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent/chat` | AI 对话 |

### 支付/订阅接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/billing/plans` | 获取可售计划 |
| GET | `/api/billing/me` | 我的订阅/订单 |
| POST | `/api/billing/checkout` | 创建结账会话 |
| POST | `/api/billing/checkout/confirm` | 确认支付结果 |

### 管理后台接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/admin/style-profiles` | 排版预设管理 |
| GET/POST | `/api/admin/doc-types` | 文档类型管理 |
| GET/POST | `/api/admin/skills` | AI Skill 管理 |

> 完整 API 文档详见 `docs/FRONTEND_API_HANDOFF.md` 和 `docs/FRONTEND_BILLING_HANDOFF.md`

---

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发（前后端同时）
pnpm dev

# 仅前端开发
pnpm --filter @black-bean-sprouts/web dev

# 仅后端开发
pnpm --filter @black-bean-sprouts/server dev

# 类型检查
pnpm typecheck

# 构建
pnpm build

# 数据库操作
pnpm db:generate    # 生成 Prisma Client
pnpm db:push        # 推送 schema 到数据库
pnpm db:migrate     # 执行迁移

# 冒烟测试
pnpm run smoke:workbench        # 离线工作台链路测试
pnpm run smoke:workbench-live   # 在线 AI 全流程测试
pnpm run smoke:billing          # 支付链路测试
```

---

## 开发注意事项

### 鉴权

- 开发态登录：`POST /api/auth/login`，传入 `{ "email": "user@example.com" }`
- 邮箱包含 `admin` 时返回 `ADMIN` 角色，否则 `USER`
- Token 通过 `apiFetch` 自动携带，无需手动处理

### 导出接口特殊处理

`/api/workbench/export` 返回的是二进制文件流，不是 JSON：

```typescript
const response = await fetch("/api/workbench/export", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "document.docx";
link.click();
URL.revokeObjectURL(url);
```

### Patch 冲突处理

提交 Patch 时可能遇到版本冲突（409）：

```typescript
// 收到冲突响应时：
// 1. 重新拉取最新文档
// 2. 提示用户重试或做冲突处理
```

### 不可变性原则

项目遵循不可变数据原则，修改对象时请创建新副本：

```typescript
// 正确
const newDoc = { ...doc, metadata: { ...doc.metadata, title: "新标题" } };

// 错误 — 直接修改原对象
doc.metadata.title = "新标题";
```

---

## 相关文档

| 文档 | 内容 |
|------|------|
| `docs/FRONTEND_API_HANDOFF.md` | 前端 API 完整接入指南 |
| `docs/FRONTEND_BILLING_HANDOFF.md` | 支付/订阅前端接入指南 |
| `docs/RUN_WORKBENCH.md` | 工作台启动与 AI 配置 |
| `packages/doc-schema/src/doc/types.ts` | Doc AST 类型定义 |
| `packages/doc-schema/src/patch/types.ts` | Patch 类型定义 |
| `packages/web/src/lib/api.ts` | 前端 API 请求封装 |

---

## 后端源码入口（调试参考）

| 文件 | 说明 |
|------|------|
| `packages/server/src/index.ts` | 服务启动入口 |
| `packages/server/src/plugins/auth.ts` | JWT 鉴权插件 |
| `packages/server/src/routes/workbench/index.ts` | Workbench API |
| `packages/server/src/routes/document/patches.ts` | Patch 接口 |
| `packages/server/src/routes/billing/index.ts` | 支付接口 |
| `packages/server/src/routes/agent/index.ts` | Agent 对话接口 |

---

## 许可证

Private — 内部项目
