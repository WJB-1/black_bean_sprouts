# 黑豆芽开发进度

> 最后更新：2026-04-22  
> 本文档只记录已经完成并验证过的进度，不写“预计完成”。

## 0. 当前真实状态

### 已完成

- `packages/xiaolongxia-kernel` 已建立为 Agent 内核接入边界。
- `/api/agent/chat` 已通过 `createXiaolongxiaRuntime()` 进入内核边界。
- `workingMemory.kernel` 已持久化：
  - `sessionKey`
  - `skillsSnapshot`
  - `agentId`
  - `lastRunId`
- `DocumentPatch` 写入链已打通：
  - web -> server -> doc-schema
  - agent -> kernel -> tool -> server -> doc-schema
- 文档 patch 写库后会同步更新：
  - `Document.content`
  - `Document.meta`
  - `Document.title`
- 前端文档页已重写为 Apple 风格 patch-first 编辑器。
- `pnpm smoke`、`pnpm typecheck`、`pnpm build` 已通过。
- 后端服务已启动并通过 `GET /api/health`。
- 前端开发服务已启动并可返回 HTTP 200。

### 仍未完成

- `xiaolongxia-kernel` 还没有接入真正的 OpenClaw `agent-command / gateway / session-store`。
- 真实 OpenAI-compatible 模型链路还没有做生产级 smoke。
- `StyleProfile -> doc-engine -> render route` 还不是完整闭环。
- BullMQ / Redis / MinIO / admin 权限还没有形成生产链路。
- 前端复杂块（figure / table / formula / cover 等）还没有完成 patch 编辑 UI。

## 1. 模块进度总览

| 模块 | 状态 | 当前结论 |
|---|---|---|
| M0 工程基线与文档治理 | DONE | 计划书、进度、冒烟文档已重写为真实状态 |
| M1 DocumentPatch 引擎 | DONE | patch apply 与运行时验证可用，支持字段清空 |
| M2 DocumentApplicationService | DONE | `PATCH /api/documents/:id/patches` 已真实写库 smoke 通过 |
| M3 Agent 文档工具链 | DONE | mock kernel/provider 已真实修改 DB 文档并发出 SSE 事件 |
| M4 小龙虾 / OpenClaw 深接入 | IN PROGRESS | 已有 runtime 边界和 lifecycle 事件，但还不是完整 OpenClaw 主链 |
| M5 前端 AST / Patch 编辑器 | DONE（基线） | Apple 风格编辑器已落地，支持 meta/section/paragraph/abstract |
| M6 渲染与 StyleProfile 闭环 | TODO | 当前只有最小 DOCX 渲染 smoke，未打通真实 profile |
| M7 队列、对象存储、后台权限 | TODO | 生产链路未闭环 |
| M8 测试与自动冒烟 | IN PROGRESS | 已有一键 smoke，仍缺真实 LLM/队列/存储 smoke |

## 2. 本轮完成内容

### 2.1 修复了真正的后端根因

- 修复 `update_meta` 后 `Document.title` 不同步的问题。
- 修复 `update_meta` 无法清空可选字段的问题：
  - 前端现在可以传 `null`
  - patch engine 会把 `null` 解释为删除字段

### 2.2 补齐了端到端 patch 链

- 新增 `scripts/smoke/document-patch-api.ts`
  - 验证 patch API 真实写库
  - 验证 section 插入
  - 验证标题同步落库
- 新增 `scripts/smoke/agent-patch.ts`
  - 验证 agent/chat -> kernel -> tool -> DB
  - 验证 `kernel_session`
  - 验证 `kernel_lifecycle`
  - 验证 `document_patched`
  - 验证 `workingMemory.kernel.*` 落库

### 2.3 重写了前端文档工作区

- 新增 `packages/web/src/components/editor/DocumentEditorShell.vue`
- 新增 `packages/web/src/components/editor/BlockTreeEditor.vue`
- 新增 `packages/web/src/components/editor/BlockEditor.vue`
- 新增 `packages/web/src/components/editor/InlineTextEditor.vue`
- 新增 `packages/web/src/lib/doc-editor.ts`
- `useDocumentStore` 新增 `applyPatches(...)`
- `AgentChat.vue` 已支持：
  - `kernel_session`
  - `kernel_lifecycle`
  - `document_patched`

## 3. 当前可用能力

### 用户手动编辑

- 修改标题
- 修改副标题
- 修改机构
- 修改关键词
- 新增 / 删除 / 移动章节
- 新增 / 删除 / 移动段落
- 编辑摘要语言与关键词

### Agent 自动编辑

- 通过 `/api/agent/chat` 调用 mock provider
- 真实生成 `patch_document`
- 真实写入数据库
- 前端可感知 `document_patched`

### 工程验证

- `pnpm smoke`
- `pnpm typecheck`
- `pnpm build`
- 后端 `http://127.0.0.1:4000/api/health`
- 前端 `http://127.0.0.1:5173/`

## 4. 下一阶段必须继续的工作

1. 在 `packages/xiaolongxia-kernel` 内落真正的 OpenClaw command/gateway/session 主链。
2. 把复杂块编辑器补齐到 `figure / table / formula / cover`。
3. 让 `StyleProfile` 真正影响 `doc-engine` 输出。
4. 把 render job 放进队列，结果落 MinIO。
5. 给真实 LLM、BullMQ、MinIO 增加 smoke。

## 5. 当前提醒

- `packages/web` 主 chunk 仍然偏大，`vite build` 会给出 chunk size warning。
- 当前运行中的开发服务：
  - 后端：`http://127.0.0.1:4000`
  - 前端：`http://127.0.0.1:5173`
