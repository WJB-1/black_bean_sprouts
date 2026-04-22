# 黑豆芽开发进度与后续计划

> 最后更新：2026-04-22  
> 本文档写给后续执行 Agent。不要按“预计时间”推进，只按依赖关系、真实完成标准和可验证证据推进。  
> 最高优先级事实：**小龙虾 / OpenClaw 不是参考项目，而是本项目后端 Agent 的内核模块**。任何把它当成“参考架构”的实现都属于方向错误。

## 0. 当前硬结论

### 0.1 当前仓库没有真实小龙虾内核

已核实：当前 `black_bean_sprouts` 后端没有接入真实小龙虾 / OpenClaw Agent 内核。现有 Agent 路径是手写的简化替代品：

- `packages/agent-runtime/src/orchestrator/orchestrator.ts`：自定义 `AgentOrchestrator`，只做 LLM 调用、工具调用循环和 SSE 事件转换。
- `packages/agent-runtime/src/tools/registry.ts`：自定义 `ToolRegistry`，没有小龙虾的 gateway、session store、agent command、skills snapshot、run lifecycle。
- `packages/agent-runtime/src/llm/openai-compat.ts`：简单 OpenAI-compatible Provider。
- `packages/server/src/routes/agent/chat.ts`：路由里直接构造 orchestrator，说明后端没有稳定的内核模块边界。
- `packages/server/packages/agent-runtime`：只是空目录壳，不是内核源码。

因此，旧文档里“Agent runtime 已完成”“以小龙虾为参考”的说法全部作废。

### 0.2 小龙虾源码调研结论

本机已克隆真实小龙虾源码到：

```text
E:\Coding\校外\openclaw_reference
```

关键内核入口与概念：

- `src/commands/agent.ts`：直接 `export * from "../agents/agent-command.js"`。
- `src/agents/agent-command.ts`：真实 Agent 命令入口，负责会话解析、模型选择、技能加载、运行生命周期、fallback、workspace、执行 runtime。
- `src/gateway/server-methods/agent.ts`：gateway 的 `agent` / `agent.wait` / identity 等 server methods，负责请求接入、sessionKey 解析、delivery plan、run id、事件订阅。
- `src/config/sessions/types.ts`：`SessionEntry`，保存 `sessionId`、`skillsSnapshot`、模型覆盖、token、运行状态、父子会话、delivery context 等状态。
- `src/routing/session-key.ts`：`agent:<agentId>:<rest>` 会话键体系，包含 `buildAgentMainSessionKey`、`resolveAgentIdFromSessionKey` 等。
- `docs/concepts/agent.md`、`docs/concepts/agent-loop.md`、`docs/concepts/session.md`：说明 Agent loop、gateway-owned session store、session lifecycle。

重要限制：OpenClaw npm 根导出目前没有干净暴露 `agentCommandFromIngress` 这类内核入口；根导出主要在 `src/library.ts`，只公开 config/session store 等库能力。因此本项目要满足“直接作为后端模块存在”，必须走**内核模块化 vendoring / adapter**，不能只靠 npm 普通 import。

## 1. 正确目标架构

本项目的 Agent 后端应是：

```text
web
  -> server routes
  -> server application services
  -> xiaolongxia-kernel module
  -> OpenClaw agent command / session / skills / event lifecycle
  -> black-bean document tools
  -> doc-schema / doc-engine / storage / queue
```

### 1.1 模块职责

#### `packages/xiaolongxia-kernel`

这是后端 Agent 内核模块边界，必须逐步承载小龙虾核心概念：

- `KernelSessionEntry`：项目内会话记录，必须包含 `sessionKey`、`sessionId`、`userId`、`documentId`、`skillsSnapshot`、`workingMemory`。
- `KernelIngress`：从 Web/API 进入内核的一次用户消息，语义对齐 OpenClaw gateway ingress。
- `KernelRuntime`：执行一轮 Agent turn，输出 `KernelStreamEvent`。
- `session-key`：统一生成 `agent:black-bean-sprouts:...` 格式会话键，禁止继续用无语义随机 id 当内核会话键。
- `skillsSnapshot`：每次运行必须固化本轮可用技能和工具，不能只临时读 DB。
- `legacy-adapter`：短期过渡层，只能用于把现有手写 runtime 包起来；它不是目标内核，后续必须替换为真实 OpenClaw command/gateway 运行路径。

#### `packages/server`

Server 不应该构造 LLM Provider、ToolRegistry、Orchestrator。它只做：

- HTTP 鉴权和入参校验。
- `AgentApplicationService`：创建/加载 AgentSession，写入用户消息，调用 `xiaolongxia-kernel`，持久化 assistant/tool 事件。
- `DocumentApplicationService`：统一执行 `DocumentPatch -> apply -> validate -> persist`。
- `RenderApplicationService`：统一执行 `StyleProfile resolve -> DocxRenderer -> queue/storage/job state`。
- 数据库、权限、外部 provider 的适配。

#### `packages/agent-runtime`

当前这个包只是历史遗留过渡实现：

- 不能再被称为“小龙虾内核”。
- 不能由 route 直接构造。
- 后续要么完全删除，要么降级为 `xiaolongxia-kernel` 内部的一个临时 adapter。

#### `packages/doc-schema`

唯一文档真相源：

- `Doc`、`BlockNode`、`InlineNode`、`StyleProfile`、`DocumentPatch`。
- 所有 Agent 工具、前端编辑器、渲染器都必须只通过 AST/Patch 协作。

#### `packages/web`

前端是产品 UI，不拥有文档业务真相：

- Apple 风格 UI 可以继续，但不能掩盖核心能力缺失。
- `DocEditor` 必须升级为 AST block editor。
- Agent SSE 收到 `document_patched` 后必须刷新或本地应用 patch。

## 2. 当前真实完成状态

### 可继续使用的底座

- Monorepo、pnpm workspace、TypeScript strict 配置已经存在。
- `doc-schema` 已有基础 AST / StyleProfile / Patch 类型与部分校验入口。
- `doc-engine` 已能生成最小 `.docx` Buffer。
- `server` 已有 Fastify、Prisma、JWT、文档 CRUD、Agent SSE 路由雏形。
- `web` 已有登录、文档列表、文档详情、Agent 聊天面板和 Apple 风格外壳。

### 不得再宣称完成的能力

- Agent 内核：未完成。当前没有真实小龙虾/OpenClaw 内核。
- Agent 修改文档：未完成。`patchDocumentTool` 当前保存原文档，未应用 patch。
- 前端编辑器：未完成。当前主要是只读预览，不是 AST 编辑器。
- 渲染队列：未完成。`RenderJob` 模型存在，但路由仍同步渲染。
- StyleProfile 闭环：未完成。DB 样式管理与 DocxRenderer 尚未完整打通。
- 权限系统：未完成。后台接口缺少管理员隔离。
- 外部集成：未完成。SMS、WeChat、LLM、Redis、MinIO 生产链路均未完整联调。

## 3. 后续开发顺序

### Phase A：恢复小龙虾内核边界

目标：让后端 Agent 入口不再直接使用自制 orchestrator，而是统一通过小龙虾内核模块。

必须完成：

- 新增 `packages/xiaolongxia-kernel`，作为唯一 Agent 内核包。
- Server 的 `/api/agent/chat` 只调用 `AgentApplicationService` 或 `xiaolongxia-kernel`，不能直接 new `AgentOrchestrator`。
- `AgentSession.workingMemory` 中必须保存内核元数据：
  - `kernel.sessionKey`
  - `kernel.skillsSnapshot`
  - `kernel.agentId`
  - `kernel.lastRunId`
- 修复 `routes/agent/session.ts` 仍使用 24 位 hex 的错误校验；Prisma 主键是 `cuid()`。
- 后续将 `packages/agent-runtime` 收口为 `xiaolongxia-kernel` 的临时 adapter，最终替换为 OpenClaw command/gateway 路径。

关系图：

```text
routes/agent/chat
  -> AgentApplicationService.sendMessage
  -> XiaolongxiaKernel.run
  -> KernelSessionEntry(sessionKey, skillsSnapshot)
  -> BlackBean document tools
  -> Prisma AgentMessage / AgentSession
```

完成门槛：

- route 中不能再出现 `new AgentOrchestrator`、`new ToolRegistry`、`new OpenAICompatProvider`。
- 每个 AgentSession 都能查到稳定 `sessionKey` 和 `skillsSnapshot`。
- 一轮聊天后，用户消息、assistant 文本、工具结果都能落库。

### Phase B：接入真实 OpenClaw command/gateway 执行路径

目标：把 `xiaolongxia-kernel` 内部的临时 adapter 替换为真实小龙虾执行路径。

必须完成：

- 从 `openclaw_reference` vendoring 必要内核源码或抽取稳定子模块，不再只复制概念。
- 对齐 `agentCommandFromIngress` 所需参数：
  - `message`
  - `sessionId`
  - `sessionKey`
  - `runId`
  - `provider/model override`
  - `extraSystemPrompt`
  - `workspaceDir`
  - `skillsSnapshot`
- 建立项目自己的 OpenClaw config 映射：
  - agentId：`black-bean-sprouts`
  - workspace：文档级临时工作区或项目级 workspace
  - skills：毕业论文/SCI/项目申请书等文档技能
  - tools：文档查询、文档 patch、渲染、引用、资源、任务队列
- 建立事件转换：
  - OpenClaw lifecycle/tool/message event
  - 转为 Web SSE 的 `message_delta`、`tool_call_start`、`tool_call_result`、`document_patched`、`done`

完成门槛：

- 仓库内能看到真实小龙虾内核源码或明确 vendored 子模块。
- `xiaolongxia-kernel` 不再依赖 `packages/agent-runtime/src/orchestrator/orchestrator.ts`。
- smoke 能证明一轮 Agent 运行走的是 OpenClaw command/gateway 路径。

### Phase C：DocumentPatch 真执行

目标：Agent 和前端所有写入都通过统一 patch 管道。

必须完成：

- `doc-schema` 新增或补齐 `applyDocumentPatches(doc, patches)`。
- Patch 类型覆盖：
  - `insert_block`
  - `remove_block`
  - `move_block`
  - `update_block_attrs`
  - `update_text`
  - `update_meta`
  - `upsert_reference`
  - `remove_reference`
  - `upsert_asset`
  - `remove_asset`
- `DocumentApplicationService.applyPatches`：
  - 加载文档
  - 应用 patch
  - `isValidDoc(nextDoc)`
  - 保存 `Document.content`
  - 返回新文档
- `patch_document` 工具参数改为 `DocumentPatch[]`，不得再维护一套伪 operation schema。

关系图：

```text
LLM tool call / Web editor action
  -> DocumentPatch[]
  -> applyDocumentPatches
  -> isValidDoc
  -> DocumentApplicationService.applyPatches
  -> Prisma Document.content
  -> SSE document_patched
```

完成门槛：

- Agent 发起 `patch_document` 后数据库文档内容可观察变化。
- 非法 patch 不入库，错误可追踪。
- 单元测试覆盖正常、节点不存在、非法移动、引用/资源 upsert/remove。

### Phase D：服务层重构

目标：route 只做 HTTP，业务逻辑进入 application service。

必须完成：

- `AgentApplicationService`
  - `createOrLoadSession`
  - `appendUserMessage`
  - `runKernelTurn`
  - `persistKernelEvent`
  - `finalizeAssistantMessage`
- `DocumentApplicationService`
  - `createDocument`
  - `applyPatches`
  - `updateMeta`
  - `deleteDocument`
- `RenderApplicationService`
  - `createRenderJob`
  - `resolveStyleProfile`
  - `renderDocx`
  - `persistResult`

完成门槛：

- `routes/**` 不直接访问复杂业务流程。
- 核心流程可以用 service 层测试覆盖，不依赖 HTTP。

### Phase E：前端 AST 编辑器重建

目标：把当前只读预览升级为可编辑 AST block editor。

必须完成：

- `DocumentEditorShell`：加载、保存状态、工具栏。
- `BlockTreeEditor`：遍历 `BlockNode[]`。
- `BlockEditor`：按 block 类型分派编辑组件。
- `InlineTextEditor`：编辑 paragraph/table/caption 内的 `InlineNode[]`。
- `DocumentPreview`：保留只读预览。
- `documentStore.applyPatches(documentId, patches)`：统一提交 patch。

完成门槛：

- 修改标题、章节、段落、表格单元格、caption 后刷新页面仍存在。
- 前端不直接整体覆盖 `Doc.content`。

### Phase F：渲染与样式闭环

目标：让排版平台名副其实。

必须完成：

- 删除 render route 内联 default style。
- 样式解析优先级：
  1. 文档绑定 `styleProfileId`
  2. 当前 `DocType.code` 的 active 默认样式
  3. `doc-engine` 内置 default
- `DocxRenderer` 消费真实 `StyleProfile`：
  - 页面大小/边距
  - 字体
  - heading/paragraph/caption
  - 图表公式编号
  - bibliography
- asset loader 从 `Doc.assets[assetId].storageKey` 取图。

完成门槛：

- 同一文档使用两个 StyleProfile 导出有可观察差异。
- 有引用 AST 时，参考文献列表不是占位文本。
- 有图片 asset 时，Word 中能看到图片。

### Phase G：队列、存储、后台权限

目标：把生产环境会坏的同步/无权限逻辑补齐。

必须完成：

- Redis/BullMQ 或明确替代队列。
- `RenderWorker` 真正消费 `RenderJob`。
- MinIO/S3 对象存储接入资源和渲染结果。
- `User.role` 或独立权限模型。
- `requireAdmin` hook。
- `/api/admin/*` 全部加管理员校验。

完成门槛：

- 关闭浏览器后渲染任务仍完成。
- 普通用户不能访问后台 API。
- worker 失败会写入 `RenderJob.status=FAILED` 和错误信息。

### Phase H：测试与冒烟体系

目标：从“手工看日志”升级为可回归测试。

必须完成：

- `doc-schema`：validator + patch engine 单元测试。
- `doc-engine`：fixture AST 到 `.docx` 的结构检查。
- `xiaolongxia-kernel`：sessionKey、skillsSnapshot、event mapping、adapter 测试。
- `server`：route/service 集成测试。
- `web`：store、SSE parser、关键编辑组件测试。
- `scripts/smoke`：统一全量冒烟脚本。
- `docs/SMOKE_ASSESSMENT.md`：记录每次全量冒烟结果。

完成门槛：

- 新增 block 类型、patch op、tool 时，测试能指出缺失链路。
- CI 至少跑 install、typecheck、build、unit、无外部服务 smoke。

## 4. 当前最高优先级问题清单

### P0：方向错误或核心能力缺失

- 当前 Agent 内核不是小龙虾/OpenClaw。
- `patchDocumentTool` 不应用 patch。
- `/api/agent/chat` 路由直接构造 runtime，破坏内核边界。
- Agent session 仍有错误 24 位 hex 校验。
- 前端编辑器不可编辑。

### P1：会导致生产错误

- 后台接口缺管理员权限。
- 渲染同步执行，队列未闭环。
- StyleProfile DB 与 DocxRenderer 未闭环。
- SMS/WeChat/LLM 外部请求缺生产级超时、重试、错误分类。

### P2：体验与维护问题

- `@tiptap/*` 等依赖需要确认接入或移除。
- Web chunk 偏大，需要按路由和组件拆包。
- 预览对部分 block 类型仍是“不支持”或占位。

## 5. 每次开发固定执行顺序

1. 先读 `CLAUDE.md`、本文件和相关包的 `package.json`。
2. 涉及 Agent 时，先判断是否会绕过 `xiaolongxia-kernel`；绕过即错误。
3. 涉及文档写入时，必须走 `DocumentPatch -> apply -> validate -> persist`。
4. 涉及渲染时，必须走 `StyleProfile resolve -> DocxRenderer -> storage/job state`。
5. 涉及前端编辑时，必须生成 patch，不允许整体直接覆盖 AST。
6. 修改后至少跑被改包的 typecheck/build 和对应 smoke。
7. 更新本文件中的状态或已知问题，不允许只改代码不改计划。

## 6. 下一批应改文件

优先顺序：

- `packages/xiaolongxia-kernel/**`
- `packages/server/src/routes/agent/chat.ts`
- `packages/server/src/routes/agent/session.ts`
- `packages/server/src/services/agentApplication.ts`
- `packages/doc-schema/src/patch/**`
- `packages/agent-runtime/src/tools/patch-document.ts`

第一批交付目标：

```text
Web message
  -> /api/agent/chat
  -> AgentApplicationService
  -> XiaolongxiaKernel.run
  -> stable sessionKey + skillsSnapshot
  -> persisted AgentMessage events
  -> SSE back to web
```

这条链路打通前，项目不能再宣称“Agent 内核完成”。
