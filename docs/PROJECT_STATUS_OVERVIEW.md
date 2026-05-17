# 黑豆芽项目现状说明

> 更新时间：2026-05-17  
> 目标读者：项目作者、协作同事、后续接手开发的人  
> 范围：`black_bean_sprouts` 整个 monorepo，包括前端、后端、文档引擎、AI runner、Claude/OpenClaw 状态、本地启动和已知风险。

---

## 1. 一句话结论

黑豆芽现在是一个 **Vue 3 前端 + Fastify 后端 + Prisma 数据模型 + 文档 AST/渲染引擎 + AI runner 抽象** 的医学/学术文档工作台。

当前最重要的事实是：

- 后端 Web 架构没有换，仍然是 **Fastify + Prisma + API routes**。
- 文档数据结构没有换，核心仍然是 `@black-bean-sprouts/doc-schema` 的 `Doc` / `BlockNode` AST。
- AI 内核外层抽象仍保留 `OpenClawPort` / `OpenClawAdapter` 形状。
- 但当前实际推荐主链已经改成 **本地 Claude Code runner**，而不是直接依赖外部 OpenClaw runtime。
- Claude runner 通过项目本地安装的 `claude` binary，以 `bash -lc 'exec "$CLAUDE_CODE_BIN" "$@"'` 方式执行 `claude -p ...`。
- Claude Skills 和 DOCX MCP 已经按项目本地隔离方式接入，适合当前“直接 Word”和长文档处理。
- OpenClaw 没有删除，仍然是可选 provider / 兼容路径，但不是当前最稳的默认主链。

推荐当前开发口径：

> 后端主体架构仍是 Fastify + Prisma；AI 执行层从真实 OpenClaw runtime 迁移到了本地 Claude Code runner。OpenClaw adapter 仍保留，用于兼容既有 KernelEvent / OpenClawPort 抽象。当前主链建议继续使用 Claude Code，OpenClaw 作为后续可验证的备选路径保留。

---

## 2. 当前仓库状态

仓库目录：

```text
black_bean_sprouts/
├── packages/
│   ├── web/                  # Vue 3 前端
│   ├── server/               # Fastify 后端
│   ├── doc-schema/           # 文档 AST、patch、validate
│   ├── doc-engine/           # DOCX / LaTeX 渲染
│   ├── xiaolongxia-kernel/   # KernelEvent、OpenClawPort、adapter
│   └── agent-runtime/        # 早期工具/Skill 抽象，当前不是主链
├── prisma/
│   └── schema.prisma         # Prisma 数据模型
├── skills/
│   └── workbench-word/       # 直接 Word 工作流使用的 Skill
├── .claude/
│   └── skills/               # 项目级 Claude Skill
├── scripts/
│   ├── dev/                  # 本地安装、初始化脚本
│   └── smoke/                # smoke 测试脚本
├── docs/                     # 说明文档
├── docker-compose.yml        # Postgres / Redis / MinIO
└── package.json              # monorepo 根脚本
```

远程提交状态：

- 远程 `origin/main` 已包含 Claude 改造提交：
  - `b1ad84e Replace OpenClaw runtime with local Claude Code`
  - `a4d8057 Route direct Word through Claude file workflow`
- 这说明“改成 Claude Code runner”和“直接 Word 走 Claude 文件工作流”已经不是只在本地。

当前本地工作区还存在一批未提交的启动脚本相关改动：

- `package.json`
- `README.md`
- `docs/RUN_WORKBENCH.md`
- `start-workbench.ps1`
- `status-workbench.ps1`
- `stop-workbench.ps1`
- `scripts/workbench-dev.mjs`

这批改动的核心是：

- `npm run workbench:start/status/stop/restart` 改成跨平台 Node 脚本。
- 自动加载 `.env.example` 和 `.env`。
- 不再要求 Windows PowerShell 作为唯一一键启动方式。
- 后台启动前端和后端，并把日志写到 `.tmp/workbench-dev/logs/`。

这批启动脚本改动和“Claude runner 替代 OpenClaw runtime”不是同一件事。前者偏本地开发体验，后者偏 AI 执行实现。

---

## 3. 技术栈总览

| 层 | 当前技术 | 说明 |
|---|---|---|
| Monorepo | pnpm workspaces | 根目录统一脚本，包之间用 `workspace:*` |
| 前端 | Vue 3 + Vite + Pinia + Vue Router | 主页面是工作台、编辑器、后台 |
| 编辑器 | Tiptap / ProseMirror | 用于结构化文档编辑 |
| 后端 | Fastify 5 | API route 注册、JWT、CORS、静态前端托管 |
| 数据库 | PostgreSQL + Prisma | 用户、文档、后台配置、支付等持久化 |
| 队列 | BullMQ + Redis | 异步渲染相关，当前 Workbench 主链不强依赖 |
| 存储 | MinIO | 渲染产物/文件存储，当前 Workbench AI 主链不强依赖 |
| 文档 AST | `doc-schema` | `Doc`、块结构、patch、validate |
| 文档渲染 | `doc-engine` | DOCX、LaTeX、样式 profile |
| AI 抽象 | `xiaolongxia-kernel` | KernelEvent / OpenClawPort / adapter |
| 当前 AI 主链 | Claude Code runner | 项目本地 Claude binary + Skills + MCP |
| 备选 AI 路径 | OpenClaw / SiliconFlow direct | OpenClaw 保留，SiliconFlow direct 仍可用于结构化生成 |

---

## 4. 前端现状

前端包：

```text
packages/web/
```

核心入口：

- `packages/web/src/main.ts`
- `packages/web/src/App.vue`
- `packages/web/src/router/index.ts`
- `packages/web/src/lib/api.ts`

当前路由：

| 路由 | 页面 | 作用 |
|---|---|---|
| `/` | redirect | 重定向到 `/workbench` |
| `/workbench` | `WorkbenchPage.vue` | 主工作台 |
| `/editor/:id` | `DocumentEditor.vue` | 结构化文档编辑器 |
| `/admin` | `AdminPage.vue` | 后台管理页面 |

### 4.1 Workbench 页面

主页面：

```text
packages/web/src/pages/WorkbenchPage.vue
```

当前 Workbench 面向用户的主流程是：

```text
选择排版模板
  → 上传/粘贴原稿
  → 可选填写标题
  → 一键整理
  → 预览结构化结果
  → 导出 DOCX / LaTeX
```

页面已经包含：

- 排版模板选择。
- 快捷指令。
- 拖拽上传。
- 标题输入。
- 原稿文本输入。
- 字数和段落统计。
- 排版参数调整。
- 一键整理。
- 直接 Word。
- 结构化结果预览。
- 下载导出。
- 本地草稿恢复。
- 任务进度展示。

### 4.2 结构化编辑器

页面：

```text
packages/web/src/pages/DocumentEditor.vue
```

相关组件：

```text
packages/web/src/components/editor/
├── BlockTreeEditor.vue
├── blocks/
│   ├── AbstractBlockEditor.vue
│   ├── FigureBlockEditor.vue
│   ├── FormulaBlockEditor.vue
│   ├── HeadingBlockEditor.vue
│   ├── ParagraphBlockEditor.vue
│   ├── ReferenceListBlockEditor.vue
│   ├── SectionBlockEditor.vue
│   └── TableBlockEditor.vue
├── commands/
└── plugins/
```

编辑器的目标不是普通富文本，而是围绕 `doc-schema` 的结构化 AST 编辑：

- 标题块。
- 段落块。
- 摘要块。
- 章节块。
- 表格块。
- 图块。
- 公式块。
- 参考文献块。

### 4.3 Agent Chat

组件：

```text
packages/web/src/components/agent/AgentChat.vue
```

后端接口主要由 `packages/server/src/routes/agent/index.ts` 提供。

Agent Chat 当前通过后端 `KernelRuntime` 抽象消费 AI 事件。前端不应该直接关心底层是 Claude Code、OpenClaw 还是 fake kernel。

### 4.4 后台页面

页面：

```text
packages/web/src/pages/admin/AdminPage.vue
```

后台接口：

```text
packages/server/src/routes/admin/index.ts
```

后台目前包括几类能力：

- runtime settings。
- style profiles。
- doc types。
- skills。
- project Claude Skill files。
- Skill dry-run / live test。

后台路由要求 JWT 且用户 role 为 `ADMIN`。

### 4.5 前端 API 客户端

文件：

```text
packages/web/src/lib/api.ts
```

特点：

- 统一以 `/api` 为 base URL。
- 自动从 `localStorage` 读取 token。
- 自动设置 `Authorization: Bearer <token>`。
- 对 JSON 错误响应做统一提取。
- 网络错误会提示检查后端 `http://localhost:3000`。

Project Skill 相关 API 也在这里封装：

- `listProjectSkills`
- `getProjectSkill`
- `saveProjectSkill`
- `deleteProjectSkill`
- `testProjectSkills`

---

## 5. 后端现状

后端包：

```text
packages/server/
```

入口：

```text
packages/server/src/index.ts
```

后端启动时会：

1. 创建 Fastify app。
2. 创建 PrismaClient。
3. 尝试初始化 Redis / BullMQ / MinIO 渲染基础设施。
4. 创建 Workbench service。
5. 创建 Billing service。
6. 注册 CORS、JWT、auth plugin。
7. 注册各 API routes。
8. 如果 `packages/web/dist` 存在，则托管前端静态页面。
9. 监听 `PORT`，默认 `3000`。

### 5.1 后端 API 模块

| 模块 | 路径 | 作用 |
|---|---|---|
| Auth | `routes/auth` 由 `plugins/auth.ts` + `createAuthRoutes` 提供 | 登录、JWT、权限 |
| Document | `routes/document` | 文档持久化、patch、render |
| Agent | `routes/agent` | Agent Chat、文档修复、事件流 |
| Admin | `routes/admin` | 后台配置、Skill 管理 |
| Render Job | `routes/render-job` | 异步渲染任务 |
| Billing | `routes/billing` | 支付和订阅 |
| Workbench | `routes/workbench` | 工作台导入、生成、导出 |

### 5.2 Workbench 后端主链

主要文件：

```text
packages/server/src/routes/workbench/index.ts
packages/server/src/services/workbench-application.ts
```

主要接口：

| 接口 | 作用 |
|---|---|
| `GET /api/workbench/style-profiles` | 获取内置排版模板 |
| `POST /api/workbench/import` | 导入文本或 DOCX，提取 rawText |
| `POST /api/workbench/generate` | 同步结构化生成 |
| `POST /api/workbench/generate/stream` | NDJSON 流式结构化生成 |
| `POST /api/workbench/generate/jobs` | 创建结构化生成任务 |
| `GET /api/workbench/generate/jobs/:jobId` | 查询结构化生成任务 |
| `DELETE /api/workbench/generate/jobs/:jobId` | 取消结构化生成任务 |
| `POST /api/workbench/generate-docx` | 同步直接 Word |
| `POST /api/workbench/generate-docx/jobs` | 创建直接 Word 任务 |
| `GET /api/workbench/generate-docx/jobs/:jobId` | 查询直接 Word 任务 |
| `GET /api/workbench/generate-docx/jobs/:jobId/download` | 下载直接 Word 结果 |
| `POST /api/workbench/generate-docx/legacy` | 旧版结构化后导出 DOCX |
| `POST /api/workbench/export` | 导出 DOCX / LaTeX |

Workbench 现在有两条 AI 相关路径。

第一条是结构化 AST 路径：

```text
rawText
  → buildStructuringPrompt()
  → runPrompt()
  → parseStructuredDraftWithRecovery()
  → convertDraftToDoc()
  → isValidDoc()
  → Doc AST
  → DocxRenderer / LatexRenderer
```

这条路径的优点：

- 能进入结构化编辑器。
- 能做 AST 校验和 patch。
- 适合中短文档或结构较稳定的任务。

这条路径的缺点：

- 长文本要求模型输出大 JSON，容易超时或返回不完整。
- 返回 JSON 后还需要修复、解析和校验。

第二条是直接 Word 文件路径：

```text
rawText
  → 创建 .tmp/workbench-runs/<jobId>/
  → 写入 source.md / style.json / task.md / SKILL.md
  → Claude 按 Skill 编辑 result.md
  → 后端读取 result.md
  → 渲染 output.docx
  → 前端下载
```

这条路径的优点：

- 不要求模型返回巨大 JSON。
- 更适合长文档、Word 导出和“先可用”的用户流程。
- Claude Skill 和 MCP 更容易发挥作用。

这条路径的缺点：

- 结果主要是 Word 文件，不天然进入 AST 编辑器。
- 后续如果要回写结构化编辑器，需要再做 Markdown/AST 转换。

### 5.3 渲染和导出

渲染包：

```text
packages/doc-engine/
```

导出能力：

- DOCX：`DocxRenderer`
- LaTeX：`LatexRenderer`
- 样式 profile：内置排版模板、字号、行距、页边距等

Workbench 导出时会先解析 style settings：

```text
styleProfileId
bodyFontSizePt
lineSpacing
marginTopMm
marginBottomMm
marginLeftMm
marginRightMm
```

然后由 `doc-engine` 渲染。

### 5.4 数据库和持久化

数据库通过 Prisma 访问：

```text
prisma/schema.prisma
packages/server/src/index.ts
packages/server/src/services/*
```

当前数据库主要服务：

- 用户登录与权限。
- 文档保存。
- 后台配置。
- style profiles。
- doc types。
- skills。
- billing / subscription。

Workbench 的“直接粘贴原稿、一键整理、直接 Word 下载”在开发态并不强制依赖数据库。但登录、后台、文档保存、支付等功能需要数据库。

---

## 6. 文档 AST、Patch 和 Kernel 抽象

### 6.1 `doc-schema`

包：

```text
packages/doc-schema/
```

职责：

- 定义 `Doc`。
- 定义 `BlockNode`。
- 定义 inline text。
- 定义 patch 类型。
- 提供 patch apply。
- 提供 patch batch。
- 提供 validate。

核心导出包括：

- `Doc`
- `BlockNode`
- `ParagraphBlock`
- `HeadingBlock`
- `SectionBlock`
- `TableBlock`
- `FormulaBlock`
- `ReferenceListBlock`
- `createEmptyDoc`
- `applyPatch`
- `applyBatch`
- `isValidDoc`

这是整个系统的结构化文档基础。前端编辑器、后端导出、Agent patch 都应该围绕这个 schema，而不是各自发明文档结构。

### 6.2 `xiaolongxia-kernel`

包：

```text
packages/xiaolongxia-kernel/
```

职责：

- 定义 KernelEvent。
- 定义 OpenClawPort。
- 提供 OpenClaw adapter。
- 提供 fake kernel。
- 把底层 runner 包装成统一 `KernelRuntime`。

关键文件：

```text
src/ports/openclaw-port.ts
src/events/types.ts
src/adapters/openclaw-adapter.ts
src/adapters/fake-openclaw-kernel.ts
src/runtime.ts
```

当前重要结论：

- 这个包里的名字仍然是 OpenClaw，是因为最初设计以 OpenClaw 为内核端口。
- 现在 Claude Code runner 也被包进 `createOpenClawAdapter({ runner })`，从而复用现有事件抽象。
- 所以“还在用 OpenClaw adapter”不等于“实际执行仍然依赖 OpenClaw runtime”。

---

## 7. AI Runner 现状：Claude、OpenClaw、SiliconFlow

当前项目存在三条 AI 调用路径：

1. Claude Code runner。
2. OpenClaw runtime。
3. SiliconFlow direct。

### 7.1 Claude Code runner

主要文件：

```text
packages/server/src/integration/claude-code-runtime.ts
```

它做的事情：

- 找到项目本地 Claude binary。
- 使用项目本地 HOME。
- 设置项目本地 MCP 环境变量。
- 调用 `claude -p <prompt>`。
- 支持 `json` 和 `stream-json` 输出。
- 支持 session 记忆。
- 支持 heartbeat 进度事件。
- 支持文本 prompt 和文件 prompt。
- 把 Claude 输出转为 assistant / tool / lifecycle 事件。

关键运行方式：

```text
spawn("bash", ["-lc", 'exec "$CLAUDE_CODE_BIN" "$@"', "claude-code-local", ...args])
```

也就是说，后端不是直接调用全局 `claude`，而是：

- 使用 `.claude-runtime/npm/node_modules/.bin/claude`。
- 使用 `.claude-runtime/home` 作为 HOME。
- 使用 `.claude-runtime/mcp` 里的 DOCX MCP。

这样做的好处：

- 不污染系统级 Claude 配置。
- 不依赖用户机器上全局安装的 Claude。
- 仓库内可复现。
- 更容易在后端进程里传环境变量。
- Claude Skills 原生可用。
- MCP 原生可用。

### 7.2 Claude Skills

项目里有两类 Skill：

```text
.claude/skills/black-bean-sprouts-doc-agent/SKILL.md
skills/workbench-word/SKILL.md
```

`.claude/skills/...` 更接近 Claude Code 原生项目 Skill。

`skills/workbench-word/SKILL.md` 是直接 Word 工作流用的模板。后端会把它复制到每次任务的工作目录：

```text
.tmp/workbench-runs/<jobId>/SKILL.md
```

然后让 Claude 在该目录下读取：

```text
source.md
style.json
task.md
```

并输出：

```text
result.md
output.docx
```

这就是当前“直接 Word”能绕开大 JSON 的关键。

### 7.3 DOCX MCP

本地 MCP 安装位置：

```text
.claude-runtime/mcp/
```

关键环境变量：

```text
BBS_DOCX_MCP_COMMAND
BBS_DOCX_MCP_ENTRY
BBS_DOCX_OUTPUT_DIR
MCP_TIMEOUT
MAX_MCP_OUTPUT_TOKENS
```

原则：

- MCP 必须是项目本地安装。
- 不写入系统级 Claude 配置。
- `.claude-runtime/`、`.tmp/` 不提交。

### 7.4 OpenClaw runtime

主要文件：

```text
packages/server/src/integration/openclaw-runtime.ts
packages/server/src/integration/openclaw-config.ts
```

OpenClaw 当前的接入方式不是简单 CLI prompt，而是：

```text
OPENCLAW_PROJECT_PATH
  → dynamic import dist/index.js
  → dynamic import dist/extensionAPI.js
  → runtime.runEmbeddedPiAgent({ prompt, ... })
```

默认路径候选包含：

```text
../reference_projects/openclaw
```

当前本地环境里这个参考仓库路径不存在，所以不能直接验证 OpenClaw 真实 runtime。

OpenClaw 的优点：

- 架构上更像独立 agent runtime。
- 可以通过 OpenClaw provider 支持 OpenAI Platform、Codex OAuth 等。
- 端口-适配器设计已经完成。

OpenClaw 的问题：

- 依赖外部仓库路径。
- 依赖外部仓库构建产物和导出结构。
- OpenClaw 升级后导出名或路径变化可能影响本项目。
- Skill/MCP 的项目体验没有 Claude Code 原生路径直接。
- 真实 OpenClaw smoke 没有稳定进入主 CI。

当前建议：

> OpenClaw 保留为 provider 和兼容路径，不要急着切回默认主链。等 OpenClaw 的 CLI、Skill、MCP、smoke、部署路径都稳定后，再评估是否作为主链。

### 7.5 SiliconFlow direct

主要文件：

```text
packages/server/src/integration/siliconflow-runtime.ts
```

用途：

- 作为轻量直连模型调用。
- 可以用于 Workbench 结构化 prompt。
- 不依赖 Claude Code 或 OpenClaw。

当前 `workbench-application.ts` 的 runner 选择逻辑是：

```text
WORKBENCH_PROMPT_PROVIDER=claude-code      → Claude Code
WORKBENCH_PROMPT_PROVIDER=openclaw         → OpenClaw
WORKBENCH_PROMPT_PROVIDER=siliconflow-direct → SiliconFlow direct
存在 SILICONFLOW_API_KEY                  → SiliconFlow direct
否则                                      → Claude Code
```

如果希望当前主链明确走 Claude，建议 `.env` 中设置：

```dotenv
AI_KERNEL_PROVIDER=claude-code
WORKBENCH_PROMPT_PROVIDER=claude-code
```

---

## 8. Claude vs OpenClaw：当前决策建议

这个问题容易混淆，需要分层看。

### 8.1 没变的部分

这些没有变：

- Fastify 后端。
- Prisma 数据模型。
- Vue 前端。
- Workbench 页面。
- 文档 AST。
- DOCX / LaTeX 渲染。
- KernelEvent 抽象。
- OpenClawPort / adapter 形状。

### 8.2 已经变的部分

已经变的是 AI runner 的实际执行方式：

```text
旧方向：
后端 → OpenClaw runtime → model/tool/plugin

当前主链：
后端 → Claude Code runner → claude -p → Skills / MCP / model
```

但为了不重写上层架构，Claude Code runner 被包装成 `OpenClawAgentRunner`，再交给 `createOpenClawAdapter()`。

这就是为什么同事会看到：

```text
后端架构没变，还是 Fastify + Prisma + OpenClaw adapter
```

这句话从外层架构看是对的。

但你说：

```text
不是改成 bash 使用 claude 了吗？
```

这句话从实际 AI 执行层看也是对的。

完整表述应该是：

> 后端 Web 架构没有换，adapter 抽象也没有换；换的是 adapter 背后的 runner。当前默认推荐 runner 是本地 Claude Code，而不是外部 OpenClaw runtime。

### 8.3 继续用 Claude 的理由

当前更建议继续用 Claude Code：

- `claude -p` 是现成的非交互 CLI 调用形态。
- `--output-format stream-json` 便于后端做进度和结果解析。
- Claude Skills 是原生机制。
- MCP 也是 Claude Code 原生支持路径。
- 直接 Word 文件工作流已经跑在 Claude 上。
- 项目已经做了 `.claude-runtime/` 本地隔离。
- 不依赖外部 OpenClaw 仓库是否存在。

### 8.4 暂不切回 OpenClaw 的理由

不建议现在切回 OpenClaw 默认主链：

- 当前本地没有 `../reference_projects/openclaw`。
- OpenClaw 路径需要动态 import 外部构建产物。
- Skill 加载、MCP 接入不如 Claude 直接。
- 调试成本更高。
- 真实 smoke 覆盖不足。
- 当前业务目标是让 Workbench 和 Word 导出稳定可用，Claude 更短路径。

### 8.5 未来什么时候再考虑 OpenClaw

满足这些条件后可以重新评估：

- OpenClaw 仓库作为明确依赖被固定版本。
- OpenClaw 有稳定 CLI 或稳定 npm package API。
- OpenClaw Skill / plugin / MCP 路径清晰。
- OpenClaw live smoke 能在本地和 CI 跑通。
- Workbench 同一输入下，OpenClaw 输出质量、稳定性、速度优于 Claude。
- 部署环境能稳定提供 OpenClaw 所需 Node 版本和运行时文件。

---

## 9. 启动和本地开发

### 9.1 首次初始化

推荐：

```bash
corepack enable
npm run setup:local
```

这个脚本会做：

- 安装 workspace 依赖。
- 安装项目本地 Claude Code。
- 安装项目本地 DOCX MCP。
- 生成 Prisma Client。

### 9.2 环境变量

复制：

```bash
cp .env.example .env
```

Claude Code 推荐配置：

```dotenv
AI_KERNEL_PROVIDER=claude-code
WORKBENCH_PROMPT_PROVIDER=claude-code
CLAUDE_CODE_BASE_URL=https://api.deepseek.com/anthropic
CLAUDE_CODE_MODEL=deepseek-v4-pro[1m]
CLAUDE_CODE_HAIKU_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
DEEPSEEK_API_KEY=你的 key
```

本地基础设施可选：

```bash
docker compose up -d postgres redis minio
pnpm db:push
```

说明：

- Workbench AI/Claude 主链不强制依赖 Docker。
- 登录、后台、保存文档、支付、异步渲染等功能依赖数据库或基础设施。

### 9.3 当前推荐启动方式

如果本地跨平台启动脚本已提交/可用：

```bash
npm run workbench:start
npm run workbench:status
npm run workbench:stop
npm run workbench:restart
```

启动后访问：

```text
前端：http://localhost:5173/workbench
后端：http://localhost:3000/api
```

日志位置：

```text
.tmp/workbench-dev/logs/
```

### 9.4 手动启动方式

后端：

```bash
pnpm --filter @black-bean-sprouts/server dev
```

前端：

```bash
pnpm --filter @black-bean-sprouts/web dev
```

如果 `tsx watch` 产生端口残留，可以用：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

只杀本项目残留的 node 进程，不要批量杀全局 node。

---

## 10. 测试和 Smoke

根脚本：

```bash
npm run smoke
npm run typecheck
npm run build
```

常用 smoke：

| 命令 | 作用 |
|---|---|
| `npm run smoke:claude-code-local` | 检查项目本地 Claude Code |
| `npm run smoke:deepseek-api-live` | 检查 DeepSeek Anthropic-compatible API |
| `npm run smoke:project-skills-api` | 检查项目 Skill API |
| `npm run smoke:project-skills-live` | 真实测试项目 Skill 效果 |
| `npm run smoke:workbench` | Workbench 离线 smoke |
| `npm run smoke:workbench-live` | Workbench live smoke |
| `npm run smoke:workbench-e2e` | Playwright 打开前端做端到端测试 |
| `npm run smoke:openclaw-kernel` | OpenClaw kernel smoke |
| `npm run smoke:openclaw-config` | OpenClaw config smoke |
| `npm run test:kernel-contract` | KernelEvent 契约 |
| `npm run test:patch-contract` | patch 契约 |
| `npm run test:docx-snapshots` | DOCX snapshot |

注意：

- OpenClaw live 相关 smoke 需要外部 OpenClaw 仓库和对应配置。
- Claude live 相关 smoke 需要 `.env` 里有可用 key。
- Playwright E2E 需要浏览器运行环境。

提交前建议检查：

```bash
rg -n "sk-|DEEPSEEK_API_KEY|ANTHROPIC_AUTH_TOKEN" -S .
git status --short
```

不要提交：

```text
.env
.claude-runtime/
.tmp/
node_modules/
真实 API key
```

---

## 11. 重要文件索引

### 前端

```text
packages/web/src/pages/WorkbenchPage.vue
packages/web/src/pages/DocumentEditor.vue
packages/web/src/pages/admin/AdminPage.vue
packages/web/src/components/agent/AgentChat.vue
packages/web/src/lib/api.ts
packages/web/src/router/index.ts
```

### 后端

```text
packages/server/src/index.ts
packages/server/src/routes/workbench/index.ts
packages/server/src/services/workbench-application.ts
packages/server/src/routes/agent/index.ts
packages/server/src/routes/admin/index.ts
packages/server/src/services/project-skill-service.ts
packages/server/src/services/admin-runtime-config.ts
```

### AI 集成

```text
packages/server/src/integration/claude-code-runtime.ts
packages/server/src/integration/openclaw-runtime.ts
packages/server/src/integration/openclaw-config.ts
packages/server/src/integration/siliconflow-runtime.ts
packages/server/src/integration/integration-gateway.ts
```

### 文档结构和渲染

```text
packages/doc-schema/src/
packages/doc-engine/src/
```

### Kernel 抽象

```text
packages/xiaolongxia-kernel/src/
```

### 本地 Claude / Skill

```text
.claude/skills/black-bean-sprouts-doc-agent/SKILL.md
skills/workbench-word/SKILL.md
scripts/dev/install-claude-code-local.mjs
scripts/dev/install-docx-mcp-local.mjs
docs/LOCAL_CLAUDE_DEV_NOTES.md
```

---

## 12. 当前已知风险和债务

### 12.1 启动脚本改动尚未提交

跨平台 Node 启动脚本当前本地有改动，需要确认后提交。

影响：

- 同事如果只拉远程，可能看不到 `scripts/workbench-dev.mjs`。
- 如果文档写 `npm run workbench:start` 但远程没有该脚本，会造成误解。

建议：

- 确认脚本行为。
- 跑一次 `npm run workbench:status` / `start` / `stop`。
- 提交这批启动脚本改动。

### 12.2 OpenClaw 外部仓库缺失

当前本地未看到：

```text
../reference_projects/openclaw
```

影响：

- `WORKBENCH_PROMPT_PROVIDER=openclaw` 无法直接验证。
- `smoke:openclaw-kernel` 真实路径可能失败。

建议：

- 如果要恢复 OpenClaw 验证，先补齐外部仓库。
- 固定 OpenClaw 版本。
- 写清楚安装和构建步骤。

### 12.3 结构化 JSON 路径对长文档仍然脆弱

AST 结构化路径仍依赖模型返回完整 JSON。

风险：

- 长文档超时。
- JSON 不完整。
- schema 不合法。
- 需要 fallback。

已有缓解：

- 任务接口。
- heartbeat。
- parse recovery。
- fallback doc。
- 直接 Word 文件路径。

建议：

- 长文档优先走直接 Word。
- AST 路径用于后续编辑和结构化程度高的内容。

### 12.4 数据库和 Workbench 主链耦合度不一致

Workbench 粘贴生成和直接 Word 可在无数据库时运行较多功能，但后台、登录、保存、支付必须要数据库。

这对开发是好事，但对部署说明容易造成误解。

建议文档统一表述：

> AI/Workbench 本地调试不强制 Docker；完整产品功能需要 Postgres，异步渲染还需要 Redis 和 MinIO。

### 12.5 Skill 体系有两套概念

当前存在：

- 数据库里的 Skill 管理。
- `.claude/skills` 项目级 Claude Skill。
- `skills/workbench-word` 文件工作流 Skill。
- 早期 `agent-runtime` SkillDefinition。

这些名字都叫 Skill，但层次不同。

建议：

- 对用户和业务配置，叫“后台 Skill”。
- 对 Claude Code 原生能力，叫“Claude Project Skill”。
- 对直接 Word 模板，叫“Workbench Word Skill”。
- 不要在沟通里混用。

---

## 13. 推荐下一步

优先级从高到低：

1. 提交当前跨平台启动脚本改动。
2. 明确 `.env.example` 默认 provider，建议当前主链设为 Claude Code。
3. 跑通 `npm run smoke:claude-code-local`。
4. 跑通 Workbench 前后端手动流程：粘贴文本、一键整理、直接 Word、下载。
5. 跑通 `npm run smoke:workbench-e2e`。
6. 更新 README，链接到本说明文档。
7. 如果还要保留 OpenClaw 作为战略路径，补一份 OpenClaw 真实验证指南。
8. 给 Skill 概念改名或分层，减少同事沟通误解。
9. 决定“直接 Word”结果是否需要回流 AST 编辑器。
10. 把关键 live smoke 分层：本地必跑、可选真实 key、OpenClaw 专项。

---

## 14. 给同事解释时可以直接用的版本

可以这样说：

> 这个项目的后端框架没有换，还是 Fastify + Prisma。文档结构、渲染、KernelEvent 和 OpenClaw adapter 抽象也没有换。
>
> 变的是 adapter 背后的 AI runner。之前方向是通过外部 OpenClaw runtime 跑 agent；现在主链改成项目本地 Claude Code runner，通过 `bash -lc` 执行项目内的 `claude -p`，并使用 Claude 原生 Skills 和 DOCX MCP。
>
> 所以“后端架构没变”和“改成 bash 使用 Claude”这两句话都对，只是说的是不同层级。前者说 Web/API/adapter 架构，后者说 AI 实际执行层。
>
> 当前建议继续用 Claude Code 作为主链，因为它对 Skill、MCP、直接 Word 文件工作流更顺。OpenClaw 先保留为可选 provider，等外部仓库、CLI/API、Skill/MCP、smoke 都稳定后再考虑切回默认。

