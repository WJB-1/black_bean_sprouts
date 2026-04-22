# 黑豆芽项目计划书

> 最后更新：2026-04-22  
> 本计划写给后续继续开发的 Agent。不要按“想当然”推进，只按仓库里的真实边界、真实依赖、真实验证链推进。

## 1. 最高优先级事实

1. 小龙虾 / OpenClaw 是后端内核，不是“参考项目”。
2. 文档内容的唯一真相是 `doc-schema` 中的 `Doc AST`。
3. 所有文档写入都必须走 `DocumentPatch[]`，不能再整棵覆盖 AST。
4. 所有 Agent 入口都必须走 `packages/xiaolongxia-kernel`，不能绕过内核边界。
5. 所有渲染必须最终闭环到 `StyleProfile`，不能把样式硬编码在 AST 里。
6. 进度文档只能写已经验证过的事实，不能把“代码写了”写成“功能完成”。

## 2. 当前已落地的真实结构

### 2.1 文档编辑主链

```text
DocumentEditPage
  -> DocumentEditorShell
    -> BlockTreeEditor
      -> BlockEditor
        -> useDocumentStore.applyPatches(id, patches)
          -> PATCH /api/documents/:id/patches
            -> applyPatchesToDocument(...)
              -> applyDocumentPatches(doc, patches)
              -> isValidDoc(nextDoc)
              -> updateDocumentContent(...)
```

### 2.2 Agent 修改文档主链

```text
AgentChat
  -> POST /api/agent/chat
    -> createOrLoadAgentSession(...)
    -> createKernelSessionEntry(...)
    -> createXiaolongxiaRuntime()
      -> XiaolongxiaKernelRuntime.run(...)
        -> AgentOrchestrator.run(...)
          -> patch_document
            -> createToolServices(...).applyDocumentPatches(...)
              -> applyPatchesToDocument(...)
                -> updateDocumentContent(...)
```

### 2.3 关键模块职责

- `packages/doc-schema`
  - 负责 AST 类型、Patch 类型、运行时 schema、patch apply 逻辑。
- `packages/server`
  - 负责鉴权、路由、Prisma 持久化、Agent/Document 应用服务。
- `packages/agent-runtime`
  - 当前仍是过渡层：工具定义、provider 适配、orchestrator。
- `packages/xiaolongxia-kernel`
  - 当前是“小龙虾内核接入边界 + 生命周期事件层”。
- `packages/web`
  - 当前是 Apple 风格 UI + patch-first 编辑器基线。
- `packages/doc-engine`
  - 当前已能把最小 Doc AST 渲染为 DOCX。

## 3. 已识别并修复的真实问题

### 3.1 后端数据一致性问题

- 问题：`update_meta` 修改了 `doc.content.attrs.title`，但没有同步 `Document.title` 列。
- 影响：文档列表、数据库检索、部分 UI 会显示旧标题，看起来像“补丁成功但界面没改”。
- 现状：已修复。`updateDocumentContent()` 现在同步写入：
  - `document.title`
  - `document.meta`
  - `document.content`

### 3.2 `update_meta` 无法清空字段

- 问题：前端如果传 `undefined`，JSON 会直接丢字段；传 `null` 又会让 schema 失效。
- 影响：副标题、机构等可选字段无法被真正清空。
- 现状：已修复。`applyDocumentPatches()` 里 `update_meta` 现在按以下规则处理：
  - `value === null` -> 删除字段
  - 其他值 -> 写入字段

### 3.3 前端不是 patch-first 编辑器

- 问题：此前 `DocumentEditPage` 基本是预览 + Agent 聊天，编辑器并不存在。
- 影响：用户要求的“Apple 风格重写 + patch 写入链”没有落地。
- 现状：已修复到基线可用版本：
  - 新增 `DocumentEditorShell`
  - 新增 `BlockTreeEditor`
  - 新增 `BlockEditor`
  - 新增 `InlineTextEditor`
  - `useDocumentStore.applyPatches()` 已接入

### 3.4 缺少真正的端到端 smoke

- 问题：之前只有类型检查和局部冒烟，没有真实验证：
  - patch API 写库
  - agent -> kernel -> tool -> DB 写库
- 现状：已新增：
  - `scripts/smoke/document-patch-api.ts`
  - `scripts/smoke/agent-patch.ts`
  - 根命令 `pnpm smoke`

## 4. 参考矩阵

### 4.1 内核必须参考 / 对照的代码

- 本地 OpenClaw 参考仓库：
  - `E:\Coding\校外\openclaw_reference`
  - 已确认关键文件：
    - `E:\Coding\校外\openclaw_reference\src\agents\agent-command.ts`

### 4.2 其他模块可参考的项目

- OpenClaw（内核边界 / session / run lifecycle）
  - https://github.com/openclaw/openclaw
- Tiptap（inline command / editor 交互模型）
  - https://github.com/ueberdosis/tiptap
- BlockNote（块级编辑器交互）
  - https://github.com/TypeCellOS/BlockNote
- AppFlowy Editor（文档编辑器结构）
  - https://github.com/AppFlowy-IO/appflowy-editor
- Outline（知识库后端与权限边界）
  - https://github.com/outline/outline
- Docmost（文档工作区与管理后台）
  - https://github.com/docmost/docmost
- docx（Word 导出）
  - https://github.com/dolanmiu/docx
- BullMQ（队列）
  - https://github.com/taskforcesh/bullmq
- MinIO（对象存储）
  - https://github.com/minio/minio

## 5. 模块计划与执行边界

### M1 DocumentPatch 引擎

**状态：DONE**

已完成：

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
- `apply_style_profile`（AST no-op，占位给上层配置）

继续约束：

- 以后新增文档写入能力，先扩展 `DocumentPatch`，再扩展 server / web / agent。
- 不能再新增“直接改整棵 doc.content”的捷径。

### M2 DocumentApplicationService

**状态：DONE**

已完成：

- `applyPatchesToDocument(...)`
- `PATCH /api/documents/:id/patches`
- `DocumentPatchArraySchema` 路由校验
- DB 真实写库 smoke
- `title/meta/content` 同步落库

后续只允许做增强，不允许回退到直接覆盖 AST。

### M3 Agent 文档工具链

**状态：DONE（过渡链可用）**

已完成：

- `patch_document` 会校验 `DocumentPatch[]`
- `createToolServices(...).applyDocumentPatches(...)` 已接服务层
- Agent SSE 已能发出：
  - `kernel_session`
  - `kernel_lifecycle`
  - `document_patched`
- mock provider 已能真实修改 DB 文档

剩余问题不是“能不能改文档”，而是“是不是已经换成真正 OpenClaw 内核执行主链”。

### M4 小龙虾 / OpenClaw 内核深接入

**状态：IN PROGRESS**

当前已有：

- `XiaolongxiaKernelRuntime`
- `KernelSessionEntry`
- `workingMemory.kernel`
- `kernel_session`
- `kernel_lifecycle`

还没完成的关键点：

1. `packages/xiaolongxia-kernel` 目前仍然内部 new `AgentOrchestrator`
2. 还没有把 OpenClaw 的 `agent-command / gateway / session-store / event bus` 真正 vendoring / 抽取进来
3. 还没有做到“事件来源于真实 OpenClaw run lifecycle”

下一步必须按这个顺序推进：

1. 在 `packages/xiaolongxia-kernel` 内建立 `agent-command` 风格入口
2. 把 `KernelIngress` 映射为接近 OpenClaw 的 command 输入
3. 把 session 持久状态从当前轻量 workingMemory 扩成更稳定的 runtime state
4. 让 server 只认识 `xiaolongxia-kernel`，不再关心内部 orchestrator 细节

### M5 前端 AST / Patch 编辑器

**状态：DONE（基线版本）**

已完成：

- Apple 风格文档工作区
- patch-first 文档编辑壳
- 标题/副标题/机构/关键词编辑
- section / paragraph / abstract 的增删改移动
- 右侧实时预览
- Agent patch 后自动刷新文档

这版的边界很明确：

- 支持块类型：`section` / `paragraph` / `abstract`
- 不支持复杂块的深度编辑：`figure` / `table` / `formula` / `cover` 等
- 复杂块目前仍主要依赖 agent 生成或后续模块补齐

后续扩展必须沿现有链路：

```text
BlockEditor
  -> emit patches
  -> useDocumentStore.applyPatches(...)
  -> server patch route
  -> doc-schema patch engine
```

### M6 渲染与 StyleProfile 闭环

**状态：TODO**

必须补齐的不是“再能导出一次 Word”，而是：

1. `StyleProfile` 真正决定导出表现
2. 引用、图表、资产、编号系统进入 doc-engine
3. 同一文档在不同 style profile 下能看到明确差异

建议拆成三段推进：

1. `doc-engine` 接 `StyleProfile.page / fonts / numbering`
2. server 建立 render application service
3. web / admin 建立 profile 选择与预览

### M7 队列、对象存储、后台权限

**状态：TODO**

需要完成：

- render job 进入队列
- 导出结果落 MinIO
- admin 路由权限闭环
- 普通用户与管理员权限彻底分层

这个模块要特别注意：

- 不要把长任务继续绑在同步 HTTP 请求里
- 不要让 `/api/admin/*` 继续只是“前端入口隐藏”

### M8 测试与自动冒烟

**状态：IN PROGRESS**

当前已有：

- `pnpm smoke`
- `pnpm typecheck`
- `pnpm build`

还要继续补：

- 真正 OpenAI-compatible 模型联调 smoke
- render queue / storage smoke
- web 更完整的行为级 smoke（目前主要依赖 `vite` 启动 + HTTP 200）

## 6. 后续执行顺序

1. 先做 M4：把 `xiaolongxia-kernel` 从“薄包装”推进到“真实 OpenClaw 子模块边界”。
2. 再做 M6：让 `StyleProfile -> doc-engine -> render route` 真正闭环。
3. 再做 M7：把 render job / MinIO / admin auth 做成可生产运行的链路。
4. 最后补 M8：把真实 LLM、队列、对象存储 smoke 加进脚本化验证。

## 7. 不允许再次出现的错误

1. 把 OpenClaw 说成“参考项目”
2. 绕过 `packages/xiaolongxia-kernel`
3. 绕过 `DocumentPatch[]`
4. 前端直接整棵提交 AST 覆盖
5. 文档列表标题与 AST 标题不同步
6. 用“看起来差不多”替代真实 smoke
