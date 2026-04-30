# 黑豆芽开发手册 v2

> 修订日期：2026-04-23  
> 项目路径：`E:\Coding\校外\black_bean_sprouts`  
> 参考仓库：`E:\Coding\校外\reference_projects`  
> 本文档读者：继续开发黑豆芽的 Agent 或开发者

---

## 0. 先读这一页

**这份文档解决一个问题：拿到项目后，今天应该做什么、不能做什么、做完后怎么验证。**

如果你只有10分钟，读第1章（架构边界）和第3章（当前Gap与执行顺序）。  
如果你要开始写代码，读第4章（工作线详情）对应的那一条线。  
如果你要接入参考项目，读第5章（参考项目速查）。

---

## 1. 架构边界（不可破坏）

### 1.1 系统定位

黑豆芽是**医学/学术文档的 Agent 编辑平台**。核心链路是：

```
用户/Agent 产生意图
  → 转换为 DocumentPatchBatch
    → 服务端校验并应用到 Doc AST
      → 持久化到 DB
        → 按需通过 doc-engine 渲染导出
```

### 1.2 五条不可破坏的边界

这五条是所有开发决策的基准。遇到"要不要这样做"的问题时，先对照这五条。

| #      | 边界                                                         | 违反的典型后果                                |
| ------ | ------------------------------------------------------------ | --------------------------------------------- |
| **B1** | **所有文档写入必须走 `DocumentPatchBatch`**，内含 `expectedVersion` 和 `patches[]` | 并发覆盖、无法审计、无法回放                  |
| **B2** | **`doc-schema` 是文档唯一真相**，前端不持有文档权威副本      | 前后端状态分裂，Agent 改动被前端覆盖          |
| **B3** | **样式不进 AST**，Block 节点只记录语义，排版由 `StyleProfile` 控制 | 导出结果与 AST 耦合，无法换格式               |
| **B4** | **OpenClaw 是后端内核，不是参考项目**，必须通过端口-适配器方式接入 `xiaolongxia-kernel` | Agent 内核是假的，所有 Agent 功能建立在沙滩上 |
| **B5** | **进度只记录已验证事实**，`PROGRESS.md` 中的"完成"必须有对应 smoke/typecheck/build 通过 | 虚假进度掩盖真实债务                          |

### 1.3 包职责速查

| 包                            | 职责                                                         | 边界内不能做的事                                     |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `packages/doc-schema`         | Doc AST 定义、DocumentPatch/Batch、patch apply、TypeBox 校验 | 不能包含渲染逻辑、不能依赖 server                    |
| `packages/xiaolongxia-kernel` | OpenClaw 端口定义、适配器、Fake 实现、KernelEvent 映射       | 不能直接 new AgentOrchestrator、不能依赖 server 路由 |
| `packages/agent-runtime`      | 工具注册、LLM Provider、Skills（过渡层，后续降级为工具桥）   | 不能冒充内核主链                                     |
| `packages/doc-engine`         | DOCX 渲染、编号、引用、StyleProfile resolver                 | 不能硬编码样式、不能直接写 DB                        |
| `packages/server`             | Fastify 路由、Prisma 持久化、鉴权、应用服务层                | 不能在路由层做业务逻辑、不能硬编码 StyleProfile      |
| `packages/web`                | Vue 3 前端、编辑器 UI、Agent Chat                            | 不能持有文档真相、不能整棵 AST 覆盖                  |

---

## 2. 当前真实状态与 Gap

### 2.1 已经真实可用的链路

以下链路有代码且经过基础验证：

**人工编辑链（已通）**
```
BlockTreeEditor → useDocumentStore.applyPatches()
  → PATCH /api/documents/:id/patches
    → applyDocumentPatches(doc, patches)
    → isValidDoc(nextDoc)
    → updateDocumentContent()
```
支持：标题、副标题、机构、关键词、section/paragraph/abstract 增删改移。

**Agent 修改文档链（半通）**
```
AgentChat → POST /api/agent/chat
  → XiaolongxiaKernelRuntime.run()
    → AgentOrchestrator.run()  ← 问题在这里
      → patch_document → applyPatchesToDocument()
```
可以跑通，但 `XiaolongxiaKernelRuntime` 内部直接 `new AgentOrchestrator`，**不是真实 OpenClaw 主链**。

**渲染链（最小可用）**
```
POST /api/documents/:id/render
  → DocxRenderer.render()
  → 返回 DOCX Buffer
```
可以输出 DOCX，但：`defaultStyleProfile` 硬编码在路由里、结果没有进 MinIO、RenderJob 没有进 BullMQ。

### 2.2 Gap 清单（按影响程度排序）

| Gap                                                   | 影响                                                   | 对应工作线 |
| ----------------------------------------------------- | ------------------------------------------------------ | ---------- |
| **G1** OpenClaw 未真实接入，内核是假的                | Agent 所有功能建立在过渡 Orchestrator 上，上线即技术债 | 线A        |
| **G2** `DocumentPatch[]` 无版本保护，并发写会静默覆盖 | 多用户/Agent 并发时数据损坏无感知                      | 线B        |
| **G3** 复杂块（figure/table/formula/citation）未实现  | 医学文档核心内容无法编辑                               | 线B + 线C  |
| **G4** StyleProfile 硬编码在路由，渲染结果不可配置    | 不同期刊/格式无法切换                                  | 线D        |
| **G5** 渲染是同步 HTTP，长文档会超时                  | 生产不可用                                             | 线E        |
| **G6** 导出文件不落对象存储，无法持久化下载           | 用户无法可靠获取导出结果                               | 线E        |
| **G7** 管理接口无服务端权限校验                       | 普通用户可以改全局配置                                 | 线F        |
| **G8** 无 CI，smoke 靠人工执行                        | 任何合并都可能破坏已有链路                             | 线G        |

---

## 3. 执行顺序

### 为什么这个顺序

- **线A必须最先做**：内核是假的，其他所有 Agent 功能都建立在错误基础上。
- **线B和线G可以与线A并行**：线B改的是 doc-schema 和 server 的 patch 协议，与线A的 kernel 包不冲突；线G搭的是测试脚手架，越早越好。
- **线C依赖线B**：编辑器扩展需要 PatchBatch 协议稳定后才能对接。
- **线D、E、F相互独立**，可以在P1阶段并行。

### 执行阶段

```
P0（必须先完成，上线前阻塞项）
├── 线A：OpenClaw 真实接入（端口-适配器 + Fake + 契约测试）
├── 线B：DocumentPatchBatch 版本化 + PatchCompiler
└── 线G：CI 自动化 + smoke 脚本固化

P1（P0完成后并行推进）
├── 线C：前端编辑器扩展（复杂块 + PatchFirstPlugin）
└── 线F：后台权限与配置管理

P2（P1完成后并行推进）
├── 线D：StyleProfile DSL + 渲染闭环
└── 线E：BullMQ + MinIO 生产化
```

**P0 的并行说明**：
- 线A 写 `packages/xiaolongxia-kernel`
- 线B 写 `packages/doc-schema` 和 `packages/server/src/services`
- 线G 写 `scripts/smoke` 和 `.github/workflows`
- 三条线写入范围不重叠，可以真正并行。

---

## 4. 工作线详情

每条线包含：目标、写入范围、禁止改动范围、核心任务、输出接口、验收标准。

---

### 线A：OpenClaw 真实接入

**目标**：用端口-适配器模式把 OpenClaw 接入 `xiaolongxia-kernel`，让 `/api/agent/chat` 走真实内核主链。

**写入范围**：
```
packages/xiaolongxia-kernel/src/
  ports/openclaw-port.ts          ← 新建
  adapters/openclaw-adapter.ts    ← 新建
  adapters/fake-openclaw-kernel.ts ← 新建
  adapters/event-mapper.ts        ← 新建
  runtime.ts                      ← 修改，不再直接 new AgentOrchestrator
packages/server/src/integration/integration-gateway.ts  ← 新建或修改
packages/server/src/routes/agent/  ← 修改，读取 ENABLE_OPENCLAW_KERNEL flag
```

**禁止改动**：
```
packages/doc-schema/src/
packages/doc-engine/src/
packages/web/src/
```

**核心任务**（按顺序）：

1. 在 `openclaw-port.ts` 定义稳定端口接口，只暴露黑豆芽需要的部分：
   ```ts
   type OpenClawPort = {
     run(input: OpenClawRunInput): AsyncGenerator<OpenClawRunEvent>;
     resetSession?(sessionKey: string): Promise<void>;
   };
   ```

2. 阅读 OpenClaw 源码中的以下文件，理解主链结构：
   ```
   reference_projects/openclaw/src/agents/agent-command.ts
   reference_projects/openclaw/src/agents/command/session.ts
   reference_projects/openclaw/src/infra/agent-events.ts
   ```

3. 实现 `openclaw-adapter.ts`：调用真实 OpenClaw command 主链，把 OpenClaw event 映射为 `KernelEvent`。

4. 实现 `fake-openclaw-kernel.ts`：行为与真实 adapter 契约一致，用于测试和 flag 关闭时的兜底。

5. 修改 `runtime.ts`：`XiaolongxiaKernelRuntime` 只依赖 `OpenClawPort`，不再直接 `new AgentOrchestrator`。

6. 在 `integration-gateway.ts` 中根据 `ENABLE_OPENCLAW_KERNEL` 环境变量切换真实/Fake。

**输出接口**：
```ts
// packages/xiaolongxia-kernel/src/ports/openclaw-port.ts
export type OpenClawPort = {
  run(input: OpenClawRunInput): AsyncGenerator<OpenClawRunEvent>;
  resetSession?(sessionKey: string): Promise<void>;
};

// packages/server/src/integration/integration-gateway.ts
export type IntegrationGateway = {
  getKernelRuntime(): KernelRuntime;
};
```

**验收标准**：
- [ ] `XiaolongxiaKernelRuntime` 不再有 `new AgentOrchestrator` 的直接引用
- [ ] Real adapter 和 Fake adapter 通过同一套契约测试文件
- [ ] `ENABLE_OPENCLAW_KERNEL=false` 时，Fake 实现接管，`/api/agent/chat` 仍能 patch DB 文档
- [ ] `ENABLE_OPENCLAW_KERNEL=true` 时，真实 OpenClaw 主链运行
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm run smoke:agent-patch` 通过（mock provider 下真实写库）

---

### 线B：DocumentPatchBatch 版本化 + PatchCompiler

**目标**：所有文档写入携带 `expectedVersion`，防止并发静默覆盖；引入 `PatchCompiler` 让复杂操作由编译器生成原子批次。

**写入范围**：
```
packages/doc-schema/src/
  patch/batch.ts          ← 新建，定义 DocumentPatchBatch
  patch/compiler.ts       ← 新建，定义 PatchCompiler
  patch/apply.ts          ← 修改，支持版本校验
  doc.ts                  ← 修改，Doc 增加 version 字段
packages/server/src/services/documentApplication.ts  ← 修改
packages/server/src/routes/document/patches.ts       ← 修改，返回 409 on conflict
prisma/schema.prisma      ← 修改，Document 增加 version 字段
```

**禁止改动**：
```
packages/xiaolongxia-kernel/src/
packages/doc-engine/src/
packages/web/src/components/editor/
```

**核心任务**（按顺序）：

1. 在 `doc.ts` 的 `Doc` 类型中增加 `version: number` 字段，初始值为 0。

2. 定义 `DocumentPatchBatch`：
   ```ts
   type DocumentPatchBatch = {
     expectedVersion: number;
     patches: readonly DocumentPatch[];
     source: 'user' | 'agent' | 'system';
   };
   ```

3. 修改 `applyDocumentPatches`：增加版本校验，`doc.version !== batch.expectedVersion` 时抛出 `PatchConflictError`。

4. 修改 server 的 patch 路由：捕获 `PatchConflictError`，返回 `409 Conflict`，body 包含 `currentVersion`。

5. 实现 `PatchCompiler`：接收高层意图（如"在第3个 section 后插入新 section，包含 3 个 paragraph"），输出原子 `DocumentPatchBatch`。前端和 Agent 不再手拼复杂 patch。

6. 补充 figure/table/formula/citation/xref 的 patch 类型定义和 apply 实现。

**输出接口**：
```ts
type DocumentPatchBatch = {
  expectedVersion: number;
  patches: readonly DocumentPatch[];
  source: 'user' | 'agent' | 'system';
};

type PatchCompiler = {
  compile(intent: PatchIntent, doc: Doc): DocumentPatchBatch;
};
```

**验收标准**：
- [ ] 同一文档并发两个 patch，第二个返回 409，不静默覆盖
- [ ] 非法 patch（目标节点不存在、类型错误）不污染原文档
- [ ] `PatchCompiler.compile()` 对 section/paragraph/figure/table 意图输出正确原子批次
- [ ] `pnpm run smoke:patch` 通过
- [ ] `pnpm run smoke:patch-conflict` 通过（发送旧版本号，服务端返回 409）
- [ ] `pnpm typecheck` 通过

---

### 线C：前端编辑器扩展

**目标**：从纯自研块编辑器转为"Tiptap/ProseMirror + PatchFirstPlugin"，用成熟引擎的选区/输入法/NodeView 能力加速复杂块上线，但持久化协议仍然是 patch-first。

**前置条件**：线B完成，`DocumentPatchBatch` 类型已稳定。

**写入范围**：
```
packages/web/src/components/editor/
  blocks/SectionBlockEditor.vue
  blocks/ParagraphBlockEditor.vue
  blocks/AbstractBlockEditor.vue
  blocks/FigureBlockEditor.vue
  blocks/TableBlockEditor.vue
  blocks/FormulaBlockEditor.vue
  commands/types.ts
  commands/blockCommands.ts
  commands/inlineCommands.ts
  plugins/PatchFirstPlugin.ts    ← 核心：transaction → DocumentPatchBatch
  menus/SlashMenu.vue
packages/web/src/lib/doc-editor.ts
```

**禁止改动**：
```
packages/doc-schema/src/
packages/xiaolongxia-kernel/src/
packages/doc-engine/src/
```

**核心任务**（按顺序）：

1. 确定底层引擎：**只选 Tiptap + ProseMirror，不引入 Lexical 或 BlockNote 运行时**。

2. 实现 `PatchFirstPlugin`：
   ```ts
   type PatchFirstPlugin = {
     toPatchBatch(
       transaction: EditorTransaction,
       state: EditorState
     ): DocumentPatchBatch | null;
   };
   ```
   这是线C的核心。每次编辑器 transaction 必须先经过这个插件转换为 patch batch，再提交到服务端。不允许直接把编辑器内部状态同步到服务端。

3. 按块类型逐个实现 NodeView：section → paragraph → abstract → figure → table → formula。每种块的编辑动作都通过 `PatchFirstPlugin` 收敛。

4. 实现 SlashMenu：`/` 触发，支持插入 section、paragraph、figure、table、formula、reference。

5. 参考 BlockNote 的 slash menu 交互方式（`reference_projects/blocknote/packages/react/src/components/SuggestionMenu`），但不引入 BlockNote 运行时。

**输出接口**：
```ts
// packages/web/src/components/editor/plugins/PatchFirstPlugin.ts
export type PatchFirstPlugin = {
  toPatchBatch(
    transaction: EditorTransaction,
    state: EditorState
  ): DocumentPatchBatch | null;
};
```

**验收标准**：
- [ ] 编辑器内所有用户操作最终走 `DocumentPatchBatch` 提交，不走整棵 AST 覆盖
- [ ] figure/table/formula 块可以在编辑器中插入和编辑
- [ ] SlashMenu 可以触发并插入各类块
- [ ] `pnpm run smoke:web-patch-contract` 通过
- [ ] `pnpm build` 通过

---

### 线D：StyleProfile DSL + 渲染闭环

**目标**：把 `StyleProfile` 规范化为可序列化、可 diff、可 hash 的声明式 DSL；消除路由层硬编码；建立保守增量渲染机制。

**写入范围**：
```
packages/doc-schema/src/style/
  style-profile-dsl.ts    ← 新建，DSL 类型定义
packages/doc-engine/src/
  style-resolver.ts       ← 修改，支持 DSL 解析和 cache
  render-planner.ts       ← 新建，判断 full/incremental
  renderer/
packages/server/src/routes/document/render.ts  ← 修改，去除硬编码
packages/server/src/services/renderApplication.ts  ← 修改或新建
```

**禁止改动**：
```
packages/xiaolongxia-kernel/src/
packages/web/src/components/editor/blocks/
packages/doc-schema/src/patch/
```

**核心任务**（按顺序）：

1. 定义 `StyleProfileDsl`：必须可序列化（JSON），可 diff（字段级比较），可 hash（用于缓存键）。包含：版心尺寸、字体族、各级标题样式、图表标题、引用格式、编号规则。

2. 实现 `StyleResolverCache`：以 `profileHash` 为键，缓存解析结果，避免每次渲染重新解析。

3. 实现 `RenderPlanner`：
   ```ts
   type RenderPlan = {
     mode: 'full' | 'incremental';
     invalidatedBlockIds: readonly string[];
   };
   ```
   以下情况必须强制 `full`：编号变化、交叉引用变化、全局样式变化、分页影响。

4. 修改渲染路由：从 DB 加载文档关联的 `StyleProfile`，通过 DSL 解析，不再硬编码 `defaultStyleProfile`。

5. 补全 DOCX 渲染对所有 BlockNode 类型的覆盖：figure、table、formula、reference list。

**输出接口**：
```ts
type StyleProfileDsl = {
  id: string;
  hash: string;  // 自动计算，用于缓存键
  pageLayout: PageLayout;
  fonts: FontConfig;
  headings: HeadingStyleMap;
  figureCaption: CaptionStyle;
  tableCaption: CaptionStyle;
  referenceFormat: ReferenceFormatConfig;
  numbering: NumberingConfig;
};

type RenderPlan = {
  mode: 'full' | 'incremental';
  invalidatedBlockIds: readonly string[];
};
```

**验收标准**：
- [ ] 同一 Doc 使用两个不同 StyleProfile 渲染，输出 DOCX 有可检测差异
- [ ] 增量渲染触发全局样式变化时，自动回退到全量渲染
- [ ] `pnpm run smoke:doc-engine` 通过
- [ ] `pnpm run smoke:render-style` 通过
- [ ] `pnpm run test:docx-snapshots` 通过（XML snapshot 无回归）

---

### 线E：BullMQ + MinIO 生产化

**目标**：渲染任务异步化，导出结果进对象存储，用户通过 signed URL 下载。

**写入范围**：
```
packages/server/src/jobs/
  renderQueue.ts      ← 新建
  renderWorker.ts     ← 新建
packages/server/src/storage/
  storage-service.ts  ← 新建
packages/server/src/routes/document/render.ts    ← 修改，改为异步入队
packages/server/src/routes/render-job/index.ts   ← 新建，查询状态和下载
docker-compose.yml    ← 修改，增加 Redis 和 MinIO 服务
.env.example          ← 修改，增加相关配置项
```

**禁止改动**：
```
packages/doc-schema/src/patch/
packages/web/src/components/editor/blocks/
packages/xiaolongxia-kernel/src/
```

**核心任务**（按顺序）：

1. `docker-compose.yml` 增加 Redis（BullMQ 依赖）和 MinIO 服务。

2. 实现 `StorageService`：
   ```ts
   type StorageService = {
     putObject(key: string, body: Buffer, contentType: string): Promise<void>;
     getSignedUrl(key: string, expiresSeconds: number): Promise<string>;
     removeObject(key: string): Promise<void>;
   };
   ```
   对象 key 规范：`renders/{docId}/{jobId}.docx`，`documents/{docId}/assets/{assetId}`。

3. 实现 `renderQueue.ts`：BullMQ Queue，payload 包含 `jobId / documentId / userId / format`。

4. 实现 `renderWorker.ts`：Worker 加载文档和 StyleProfile，调用 DocxRenderer，上传到 MinIO，更新 RenderJob 状态为 COMPLETED（含 resultKey）或 FAILED（含 error）。

5. 修改渲染路由：`POST /api/documents/:id/render` 改为入队并返回 `{ jobId }`，不再同步等待渲染完成。

6. 新建下载路由：`GET /api/render-jobs/:id/download`，校验 `Document.userId === req.user.id`，返回 signed URL。

**输出接口**：
```ts
type RenderJobPayload = {
  jobId: string;
  documentId: string;
  userId: string;
  format: 'docx' | 'pdf';
};

// POST /api/documents/:id/render 响应
type RenderJobCreatedResponse = {
  jobId: string;
  status: 'PENDING';
};
```

**验收标准**：
- [ ] `docker-compose up -d` 后 Redis 和 MinIO 可连通
- [ ] `POST /render` 立即返回 `jobId`，不阻塞
- [ ] Worker 完成后 MinIO 中有对应文件，RenderJob.status 为 COMPLETED
- [ ] 普通用户无法下载他人的渲染结果（返回 403）
- [ ] `pnpm run smoke:queue-storage` 通过

---

### 线F：后台权限与配置管理

**目标**：管理接口有真实服务端权限校验；DocType、Skill、StyleProfile 可通过后台管理。

**写入范围**：
```
packages/server/src/plugins/auth.ts        ← 修改，增加 admin 角色校验
packages/server/src/routes/admin/          ← 修改或新建
packages/server/src/services/             ← 修改相关服务
packages/web/src/pages/admin/             ← 修改前端管理页面
prisma/schema.prisma                       ← 修改，User 增加明确的 role 字段
```

**禁止改动**：
```
packages/doc-engine/src/renderer/
packages/xiaolongxia-kernel/src/
```

**核心任务**（按顺序）：

1. Prisma schema 中 `User` 增加 `role: UserRole`（`USER | ADMIN`），迁移现有数据。

2. 在 Fastify auth 插件中实现 `requireAdmin()` 钩子，所有 `/api/admin/*` 路由前置校验。

3. StyleProfile 管理接口：创建、更新、启用/禁用，写入时校验 DSL schema（依赖线D完成，可先用占位实现）。

4. Skill 管理接口：创建、更新，校验 `tools` 字段中的工具名存在于当前工具注册表。

5. DocType 管理接口：创建、更新、启用/禁用。

**验收标准**：
- [ ] 普通用户访问任何 `/api/admin/*` 写接口返回 403
- [ ] Admin 用户可以创建 StyleProfile 并在渲染时使用
- [ ] `pnpm run smoke:admin-auth` 通过
- [ ] `pnpm typecheck` 通过

---

### 线G：CI 自动化与 smoke 固化

**目标**：把验证从人工习惯变成自动化流水线，防止跨包接口漂移。

**写入范围**：
```
.github/workflows/ci.yml    ← 新建
scripts/smoke/              ← 补充各专项 smoke 脚本
package.json                ← 补充 smoke:* 命令
docker-compose.yml          ← 确保 CI 可以 docker-compose up
docs/SMOKE_ASSESSMENT.md    ← 只记录真实执行结果
```

**核心任务**（按顺序）：

1. 建立 CI workflow：push/PR 时自动执行 `docker-compose up -d`（PostgreSQL/Redis/MinIO）→ `pnpm install` → `pnpm typecheck` → `pnpm build` → `pnpm smoke`。

2. 补充以下 smoke 脚本（随对应工作线完成后逐步添加）：

| Smoke 命令                 | 验证内容                                    | 依赖工作线 |
| -------------------------- | ------------------------------------------- | ---------- |
| `smoke:patch`              | patch 应用、非法 patch 拒绝、资源池写入     | 线B        |
| `smoke:patch-conflict`     | 版本冲突返回 409                            | 线B        |
| `smoke:agent-patch`        | Agent 通过 mock provider 真实 patch DB 文档 | 线A        |
| `smoke:openclaw-kernel`    | 真实 OpenClaw command 主链执行              | 线A        |
| `smoke:doc-engine`         | 最小 DOCX Buffer 输出，ZIP magic bytes 正确 | 线D        |
| `smoke:render-style`       | 不同 StyleProfile 产生可检测差异            | 线D        |
| `smoke:queue-storage`      | 入队、Worker 完成、MinIO 有文件             | 线E        |
| `smoke:admin-auth`         | 普通用户 403，Admin 成功                    | 线F        |
| `smoke:web-patch-contract` | 前端编辑不走整棵 AST 覆盖                   | 线C        |

3. 补充契约测试：
   - `test:kernel-contract`：Real adapter 与 Fake adapter 行为一致
   - `test:patch-contract`：`DocumentPatchBatch` 跨包结构一致
   - `test:tool-services-contract`：`ToolServices` 与 `IntegrationGateway` 契约一致

4. 为 DOCX 渲染增加 XML snapshot 测试，防止渲染回归。

**验收标准**：
- [ ] CI 在 push 时自动执行，不依赖人工
- [ ] `docs/SMOKE_ASSESSMENT.md` 中每条记录都有真实执行时间和输出摘要
- [ ] 任何一个 smoke 失败，CI 标红，合并被阻止

---

## 5. 参考项目速查

本章只说每个参考项目**解决黑豆芽哪个具体问题**，以及**不能做什么**。详细代码阅读路径在需要时再查。

### 5.1 OpenClaw（内核，不是参考）

**解决的问题**：Agent command 主链、session 管理、event 流。  
**阅读重点**：`src/agents/agent-command.ts`、`src/agents/command/session.ts`、`src/infra/agent-events.ts`。  
**接入方式**：端口-适配器，`xiaolongxia-kernel` 只依赖 `OpenClawPort`，不散拷源码。  
**不能做**：把 OpenClaw 文件复制进业务目录后长期手改。

### 5.2 Tiptap + ProseMirror 系列

**解决的问题**：前端编辑器的选区、输入法、NodeView、undo/redo 能力，避免自研这些底层机制。  
**阅读重点**：`tiptap/packages/core`、`prosemirror-transform/src`（Step/Mapping 设计）、`prosemirror-state/src`（Transaction 思路）。  
**接入方式**：作为编辑器底层引擎，通过 `PatchFirstPlugin` 把所有 transaction 收敛为 `DocumentPatchBatch`。  
**不能做**：把 ProseMirror schema 替换 `doc-schema`；让编辑器 transaction 直接成为持久化协议。

### 5.3 BlockNote

**解决的问题**：slash menu 交互设计、块级编辑 UI 交互模式。  
**阅读重点**：`blocknote/packages/react/src/components/SuggestionMenu`。  
**接入方式**：只借鉴交互设计，不引入 BlockNote 运行时，用 Vue 重新实现 SlashMenu。  
**不能做**：引入 BlockNote 数据模型；引入 React 组件。

### 5.4 BlockSuite / AFFiNE

**解决的问题**：产品级文档工作台的布局和 AI 入口设计参考。  
**阅读重点**：`affine/packages/frontend/core/src`（产品布局）、`blocksuite/packages/framework/store/src`（store 分层思路）。  
**不能做**：MVP 阶段引入白板/多空间/本地优先数据库；直接引入完整 BlockSuite。

### 5.5 Outline / Docmost

**解决的问题**：服务端权限模型（policy 分层）、文档列表 UX。  
**阅读重点**：`outline/server/policies`（权限分层）、`outline/server/routes`（路由与业务逻辑分离）。  
**不能做**：照搬完整的 team/collection 复杂度。

### 5.6 docx 库

**解决的问题**：DOCX 节点、段落、表格、编号、样式的具体实现方式。  
**阅读重点**：`docx/src/file/paragraph`、`docx/src/file/numbering`、`docx/src/file/styles`。  
**落点**：`packages/doc-engine/src/renderer/`。  
**不能做**：在 server 路由里硬编码样式；只处理最小段落而不覆盖所有 BlockNode。

### 5.7 BullMQ

**解决的问题**：渲染任务异步化，Worker 生命周期管理。  
**阅读重点**：`bullmq/src/classes/queue.ts`、`bullmq/src/classes/worker.ts`、`bullmq/src/classes/queue-events.ts`。  
**落点**：`packages/server/src/jobs/`。

### 5.8 MinIO

**解决的问题**：对象存储部署和权限配置参考。  
**阅读重点**：`minio/docs`、`minio/internal/auth`。  
**落点**：`packages/server/src/storage/`。  
**不能做**：把导出文件只存本地磁盘；把 MinIO key 直接当公开 URL 暴露给前端。

### 5.9 AppFlowy Editor

**解决的问题**：patch apply 的错误语义、组合操作、批处理设计参考。  
**阅读重点**：`appflowy-editor/lib/src/core/document`、`lib/src/core/transform`。  
**不能做**：引入 Flutter/Dart 运行时。

### 5.10 Yjs / Hocuspocus / Pandoc / Paged.js / Lexical

**这些是 MVP 后的事**，当前阶段只需要知道：
- **Yjs/Hocuspocus**：多人协作，必须在 patch 主链稳定后才能接入
- **Pandoc**：多格式导入导出，MVP 后做
- **Paged.js**：PDF 分页预览，先保证 DOCX 导出
- **Lexical**：只作为架构参考，当前 MVP 编辑器选 Tiptap

---

## 6. Feature Flags

每条工作线的主能力都有对应开关，用于渐进放量和安全回退：

| Flag                          | 控制内容                              | 默认值  |
| ----------------------------- | ------------------------------------- | ------- |
| `ENABLE_OPENCLAW_KERNEL`      | 真实 OpenClaw adapter vs Fake         | `false` |
| `ENABLE_PATCH_COMPILER`       | PatchCompiler vs 直接 patch           | `false` |
| `ENABLE_EDITOR_ENGINE_BRIDGE` | Tiptap+PatchFirstPlugin vs 现有编辑器 | `false` |
| `ENABLE_RENDER_DSL`           | StyleProfile DSL vs 硬编码            | `false` |
| `USE_BULLMQ_RENDER`           | 异步队列渲染 vs 同步渲染              | `false` |

**规则**：
- `IntegrationGateway` 统一读取 flag，route 层不直接判断 flag
- Flag 是阶段性迁移工具，必须有清理条件（对应工作线验收通过后删除 flag，切为默认启用）
- 不允许 flag 无限期常驻

---

## 7. 上线前验收矩阵

以下所有项目必须在 CI 中自动执行通过，不接受人工声明：

| 命令                                | 覆盖内容                            |
| ----------------------------------- | ----------------------------------- |
| `pnpm typecheck`                    | 全项目 TypeScript 严格检查          |
| `pnpm build`                        | 全项目构建                          |
| `pnpm run smoke:patch`              | patch 应用与非法 patch 拒绝         |
| `pnpm run smoke:patch-conflict`     | 版本冲突 409                        |
| `pnpm run smoke:agent-patch`        | Agent 真实 patch DB 文档            |
| `pnpm run smoke:openclaw-kernel`    | 真实 OpenClaw 主链                  |
| `pnpm run test:kernel-contract`     | Real/Fake adapter 行为契约一致      |
| `pnpm run test:patch-contract`      | DocumentPatchBatch 跨包结构一致     |
| `pnpm run smoke:doc-engine`         | 最小 DOCX Buffer 正确               |
| `pnpm run smoke:render-style`       | 不同 StyleProfile 有可检测差异      |
| `pnpm run test:docx-snapshots`      | DOCX XML snapshot 无回归            |
| `pnpm run smoke:queue-storage`      | 队列入队、Worker 完成、MinIO 有文件 |
| `pnpm run smoke:admin-auth`         | 普通用户 403，Admin 成功            |
| `pnpm run smoke:web-patch-contract` | 前端编辑不走整棵 AST 覆盖           |

---

## 8. 开始写代码前的检查清单

```
□ 确认当前任务属于哪条工作线
□ 确认写入范围不与其他线冲突（对照第4章各线的"禁止改动"）
□ 如果修改 DocumentPatch 类型，通知所有依赖方
□ 如果修改 KernelIngress/KernelEvent，更新契约测试
□ 如果新增 Prisma 字段，写好迁移脚本
□ 完成后执行：pnpm typecheck && pnpm build && pnpm smoke
□ 如果涉及 OpenClaw/队列/存储/权限，还要跑对应专项 smoke
□ 更新 PROGRESS.md 前必须先跑验证命令，不允许写未验证的"完成"
```

---

## 9. 最重要的下一步

**现在只做一件事**：

> 在 `packages/xiaolongxia-kernel` 中建立 `OpenClawPort` → `OpenClawAdapter` → `FakeOpenClawKernel` 的端口-适配器结构，让 `XiaolongxiaKernelRuntime` 不再直接 `new AgentOrchestrator`，并用 `ENABLE_OPENCLAW_KERNEL=false`（Fake）跑通 `smoke:agent-patch`（mock provider 真实写库）。

这件事完成后，Agent 内核问题才从根上解决。之后补复杂块 UI、StyleProfile 渲染、BullMQ/MinIO，才不是建立在错误内核之上。

---

## 附录：禁止事项（精简版）

1. 禁止用 `AgentOrchestrator` 冒充 OpenClaw 内核主链
2. 禁止绕过 `DocumentPatchBatch` 写文档（包括整棵 AST 覆盖）
3. 禁止在 AST 中写样式字段
4. 禁止把渲染长任务绑死在同步 HTTP
5. 禁止只写 DB job 不跑真实队列
6. 禁止管理接口只靠前端隐藏，没有服务端校验
7. 禁止同时引入 Tiptap、Lexical、BlockNote 三套编辑器运行时
8. 禁止把未执行的 smoke 写成 PASS
9. 禁止 OpenClaw 源码散拷进业务目录后长期手改
10. 禁止 feature flag 无限期常驻
