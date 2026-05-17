# AGENTS.md — 黑豆芽 (Black Bean Sprouts)

> 项目定位：**医学/学术文档的 Agent 编辑平台**  
> 核心链路：用户/Agent 意图 → `DocumentPatchBatch` → 服务端校验应用 → 持久化 → 按需渲染导出

---

## 1. 技术栈

| 层级 | 技术 |
|------|------|
| 语言 / 构建 | TypeScript 5.7 (`strict: true`, `module: NodeNext`, `composite: true`) |
| 包管理 | pnpm 9+ workspace |
| 运行时 | Node.js 20+ |
| 前端 | Vue 3.5 + Vue Router 4 + Pinia 2 + Vite 6 + TipTap 2.10 |
| 后端 | Fastify 5 + Prisma 6 + BullMQ 5 + Redis 7 (ioredis) |
| 数据库 | PostgreSQL 16 |
| 对象存储 | MinIO |
| 文档渲染 | `docx` (npm) + 自定义 LaTeX renderer |

---

## 2. Monorepo 结构

```
packages/
  agent-runtime/        # Agent 执行抽象：工具注册、LLM Provider、Skills 定义
  doc-schema/           # 文档 AST 与 Patch 系统的唯一真相源
  doc-engine/           # AST → DOCX / LaTeX 渲染引擎 + StyleProfile DSL
  server/               # Fastify 后端：API、鉴权、Prisma、队列、MinIO、应用服务
  web/                  # Vue 3 SPA：编辑器、Workbench、Agent Chat、Admin
  xiaolongxia-kernel/   # OpenClaw 端口-适配器层：KernelRuntime、事件映射、Fake 实现
prisma/
  schema.prisma         # 唯一数据库模型定义
scripts/smoke/          # 16 个垂直 smoke/contract 测试脚本
docs/                   # 工程文档（见文末参考）
```

### 包职责与边界

| 包 | 职责 | **禁止做的事** |
|---|---|---|
| `doc-schema` | Doc AST 定义、`DocumentPatchBatch`、patch apply/compile/batch、校验 | 不能包含渲染逻辑；不能依赖 server |
| `xiaolongxia-kernel` | OpenClaw 端口定义、适配器、Fake 实现、`KernelEvent` 映射 | 不能直接 `new AgentOrchestrator`；不能依赖 server 路由 |
| `agent-runtime` | 工具注册、LLM Provider、Skills（过渡层） | 不能冒充内核主链 |
| `doc-engine` | DOCX/LaTeX 渲染、编号、引用、StyleProfile resolver | 不能硬编码样式；不能直接写 DB |
| `server` | Fastify 路由、Prisma 持久化、鉴权、应用服务层、队列 | 不能在路由层做业务逻辑；不能硬编码 StyleProfile |
| `web` | Vue 3 前端、编辑器 UI、Agent Chat | 不能持有文档真相；不能整棵 AST 覆盖 |

### 依赖图

```
doc-schema
    ↓
doc-engine ←── server ←── xiaolongxia-kernel
                ↑
               web
```

`agent-runtime` 是轻量级共享契约，按需被各包引用。

---

## 3. 开发环境快速开始

### 前置依赖
- Node.js >= 20
- pnpm >= 9

### 一键启动（推荐）

```bash
# 启动后端 (:3000) + 前端 (:5173)
npm run workbench:start

# 查看状态 / 停止 / 重启
npm run workbench:status
npm run workbench:stop
npm run workbench:restart
```

`npm run workbench:start` 会自动读取 `.env.example` 和 `.env`，并启动后端 server 与 Vite dev server。

### 手动启动（备选）

```bash
# 1. 安装依赖
pnpm install

# 2. 数据库：如需登录、保存文档、支付等完整功能，先准备可访问的 PostgreSQL
pnpm db:push

# 3. 构建
pnpm build

# 4. 开发模式（并行启动所有包的 dev）
pnpm dev
```

### 环境变量

复制 `.env.example` 为 `.env`。关键配置：

- `DATABASE_URL` — PostgreSQL 连接串
- `REDIS_URL` — Redis 连接串
- `MINIO_*` — 对象存储配置
- `JWT_SECRET` — 鉴权密钥
- `SILICONFLOW_API_KEY` / `LLM_*` — AI Provider 凭证
- **Feature flags**（见第 8 节）

---

## 4. 架构边界（不可破坏）

以下五条是所有开发决策的基准。遇到"要不要这样做"时，先对照这里。

| # | 边界 | 违反的典型后果 |
|---|---|---|
| **B1** | **所有文档写入必须走 `DocumentPatchBatch`**，内含 `expectedVersion` 和 `patches[]` | 并发覆盖、无法审计、无法回放 |
| **B2** | **`doc-schema` 是文档唯一真相源**，前端不持有权威副本 | 前后端状态分裂，Agent 改动被前端覆盖 |
| **B3** | **样式不进 AST**，Block 节点只记录语义，排版由 `StyleProfile` 控制 | 导出结果与 AST 耦合，无法换格式 |
| **B4** | **OpenClaw 是后端内核，不是参考项目**，必须通过端口-适配器接入 `xiaolongxia-kernel` | Agent 内核是假的，功能建在沙滩上 |
| **B5** | **进度只记录已验证事实**，任何"完成"必须有对应 smoke / typecheck / build 通过 | 虚假进度掩盖真实债务 |

---

## 5. 核心数据流

### 5.1 人工编辑链（已通）

```
BlockTreeEditor (TipTap + PatchFirstPlugin)
  → useDocumentStore.applyPatches()
  → PATCH /api/documents/:id/patches
    → applyDocumentPatches(doc, patches)
    → isValidDoc(nextDoc)
    → updateDocumentContent()
```

### 5.2 Agent 修改文档链（半通，需改进）

```
AgentChat → POST /api/agent/chat
  → XiaolongxiaKernelRuntime.run()
    → (当前直接 new AgentOrchestrator，目标应走真实 OpenClaw 适配器)
    → patch_document → applyPatchesToDocument()
```

### 5.3 渲染链（最小可用）

```
POST /api/documents/:id/render
  → DocxRenderer.render()
  → 返回 DOCX Buffer
```

> 生产化改进中：`defaultStyleProfile` 不应硬编码在路由；结果应进 MinIO；RenderJob 应进 BullMQ。

---

## 6. 编码规范

- **TypeScript**：`strict: true`、`noUncheckedIndexedAccess: true`、`noImplicitOverride: true`、`exactOptionalPropertyTypes: false`
- **模块系统**：ESM (`module: NodeNext`)。所有 `.ts` 文件使用显式 `.js` 扩展名导入（编译后）
- **包内入口**：每个包通过 `src/index.ts` 统一导出公共 API
- **无运行时依赖即无依赖**：`doc-schema`、`xiaolongxia-kernel`、`agent-runtime` 三零依赖（仅 devDeps）
- **服务端分层**：
  - `routes/` — HTTP 路由与序列化/反序列化
  - `services/` — 应用服务层，写业务逻辑
  - `plugins/` — Fastify 插件（auth、错误处理等）
  - `jobs/` — BullMQ 队列与 Worker
- **前端分层**：
  - `pages/` — 页面级组件
  - `components/editor/` — 编辑器相关
  - `stores/` — Pinia 状态（文档状态以服务端为准）
  - `lib/api.ts` — API 客户端

---

## 7. 测试与验证

### 根目录常用命令

```bash
pnpm build          # 构建所有包
pnpm typecheck      # 全量类型检查
pnpm test           # 运行所有单元测试
pnpm lint           # 全量 lint
pnpm dev            # 并行启动所有 dev 模式
```

### Smoke / Contract 测试

`scripts/smoke/` 下包含 16 个垂直切片测试，验证端到端链路：

```bash
# 核心契约测试（CI 已包含）
pnpm run smoke:patch           # patch apply + version bump
pnpm run smoke:patch-conflict  # 409 版本冲突
pnpm run smoke:agent-patch     # Agent 经 DB 修改文档
pnpm run test:kernel-contract  # Fake vs Real 适配器事件形状一致

# 其他可用 smoke（部分未进 CI）
pnpm run smoke:doc-engine          # DOCX buffer / ZIP magic
pnpm run test:docx-snapshots       # DOCX XML 快照回归
pnpm run smoke:render-style        # StyleProfile 差异检测
pnpm run smoke:queue-storage       # BullMQ → Worker → MinIO
pnpm run smoke:admin-auth          # Admin 403 边界
pnpm run smoke:web-patch-contract  # 前端不整棵 AST 覆盖
pnpm run smoke:workbench           # 离线 workbench 全链路
pnpm run smoke:workbench-live      # 在线 workbench 全链路（需 AI Key）
```

> **原则**：新增功能必须带对应 smoke 或单元测试；修复 bug 先写复现测试再改代码。

---

## 8. CI/CD

- 文件：`.github/workflows/ci.yml`
- 触发：`push`、`pull_request`
- Runner：`ubuntu-latest`，服务：PostgreSQL 16 + Redis 7
- 步骤：`pnpm install --frozen-lockfile` → `typecheck` → `build` → 跑部分 smoke
- 当前 CI 覆盖：`smoke:patch`、`smoke:patch-conflict`、`smoke:agent-patch`、`test:kernel-contract`

---

## 9. 特性开关（Feature Flags）

通过 `.env` 中的布尔值控制逐步上线：

| Flag | 说明 | 当前默认 |
|---|---|---|
| `ENABLE_OPENCLAW_KERNEL` | 使用真实 OpenClaw 内核主链 | `false` |
| `ENABLE_PATCH_COMPILER` | 启用 PatchCompiler 优化 | `false` |
| `ENABLE_EDITOR_ENGINE_BRIDGE` | 编辑器与引擎桥接 | `false` |
| `ENABLE_RENDER_DSL` | StyleProfile DSL 渲染闭环 | `false` |
| `USE_BULLMQ_RENDER` | 异步渲染走 BullMQ | `false` |

开发新工作线时，默认关闭，验收通过后打开。

---

## 10. 数据库模型速查

核心模型（`prisma/schema.prisma`）：

- `User` — 用户（`USER` / `ADMIN`）
- `Document` — 文档（JSON content、version、关联 user/docType/styleProfile）
- `DocumentPatchRecord` — 补丁审计记录（expectedVersion、patches、source）
- `DocType` — 文档类型配置
- `StyleProfile` — 样式配置（DSL + hash）
- `Skill` — Agent Skill 配置（tools JSON）
- `RenderJob` — 异步渲染任务（BullMQ 消费）

---

## 11. 常见任务速查

| 任务 | 命令 |
|---|---|
| 生成 Prisma Client | `pnpm db:generate` |
| 创建迁移 | `pnpm db:migrate` |
| 快速推送 schema（开发） | `pnpm db:push` |
| 跑单个 smoke | `npx tsx scripts/smoke/<name>.ts` |
| 查看后端日志 | `tail -f .dev-logs/server.log` |
| 查看前端日志 | `tail -f .dev-logs/vite.log` |

---

## 12. 参考文档

项目内更详细的工程文档位于 `docs/`：

- `docs/wjb/BLACK_BEAN_SPROUTS_REFERENCE_AND_PARALLEL_DEV_GUIDE(1).md` — **开发手册 v2**：5 条架构边界、8 个 Gap、7 条工作线、参考项目使用规则、验收矩阵
- `docs/SIMPLEST_FUSION_PLAN.md` — 最小可行融合计划：MVP-0 → MVP-1 → MVP-2 路线图
- `docs/STITCH_STATUS.md` — 当前集成状态（哪些是真连的、哪些是临时的）
- `docs/RUN_WORKBENCH.md` — Workbench 启动与 smoke 测试指南

---

## 13. 给 Agent 的特别提醒

1. **改任何包前，先读它的 `package.json` 和 `src/index.ts`**，确认公共接口边界。
2. **修改 `doc-schema` 要极其谨慎** — 它是整个系统的契约层，影响 server、web、doc-engine。
3. **添加新 Patch 类型**时，必须同时更新：
   - `doc-schema/src/patch/types.ts`
   - `doc-schema/src/patch/apply.ts`
   - 对应 smoke 测试
   - 若涉及前端，更新 `PatchFirstPlugin.ts`
4. **不要在前端直接修改 `doc.content`** — 必须通过 `applyPatches()` 走服务端。
5. **OpenClaw 相关改动**只能在 `xiaolongxia-kernel` 包内，server 只通过 `KernelRuntime` 接口调用。
6. **提交前必须过本地验证**：`pnpm typecheck && pnpm build && pnpm test`（以及对应 smoke）。
