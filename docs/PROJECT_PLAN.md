# 黑豆芽项目计划书

> 最后更新：2026-04-22  
> 本计划写给后续开发 Agent。所有模块按依赖顺序推进，不按预计时间推进。每个模块必须有参考项目、落地边界、完成门槛和验证命令。

## 1. 项目定位

黑豆芽不是普通富文本编辑器，也不是单纯 AI 聊天产品。它是：

```text
医学/科研文档 AST
  + 小龙虾 Agent 内核
  + 文档 Patch 协作
  + Apple 风格前端编辑器
  + DOCX/PDF 排版导出
  + 后台配置、队列、对象存储、权限
```

最高优先级事实：

- 小龙虾 / OpenClaw 是 **Agent 后端内核**，不是参考项目。
- 其他模块必须分别参考对应领域的开源项目，不允许把小龙虾强行套到全部模块上。
- 文档内容真相只能来自 `doc-schema` 的 AST 与 `DocumentPatch`。

## 2. 参考项目矩阵

| 模块 | 参考项目 | 本项目落地方式 |
|---|---|---|
| Agent 内核 | OpenClaw | `packages/xiaolongxia-kernel` 必须逐步接入 OpenClaw command/gateway/session/run lifecycle |
| 块级文档模型 | BlockSuite / AFFiNE | `doc-schema` 和前端 block editor 参考其 block/model 分层，不照抄业务 UI |
| 富文本命令层 | ProseMirror / Tiptap / Lexical | `InlineTextEditor` 与编辑命令参考其 transaction/command/plugin 思路 |
| 协作状态 | Yjs / Hocuspocus | 后续多人协作时，Patch 和 block state 可映射到 CRDT 层 |
| 知识库后端 | Outline / Docmost | server 的 workspace、权限、后台管理、文档列表参考其服务边界 |
| DOCX/排版导出 | docx / Pandoc / Paged.js | `doc-engine` 以 AST 到 DOCX 为主，PDF/HTML 排版后续再扩展 |
| 队列 | BullMQ | 渲染、Agent 长任务、资源处理走 worker/job 状态机 |
| 对象存储 | S3/MinIO | 图片、附件、导出结果使用统一 object storage adapter |

参考链接：

- OpenClaw: https://github.com/openclaw/openclaw
- BlockSuite: https://github.com/toeverything/blocksuite
- AFFiNE: https://github.com/toeverything/AFFiNE
- ProseMirror: https://github.com/ProseMirror
- Tiptap: https://github.com/ueberdosis/tiptap
- Lexical: https://github.com/facebook/lexical
- Yjs: https://github.com/yjs/yjs
- Hocuspocus: https://github.com/ueberdosis/hocuspocus
- Outline: https://github.com/outline/outline
- Docmost: https://github.com/docmost/docmost
- docx: https://github.com/dolanmiu/docx
- Pandoc: https://github.com/jgm/pandoc
- Paged.js: https://github.com/pagedjs/pagedjs
- BullMQ: https://github.com/taskforcesh/bullmq
- MinIO: https://github.com/minio/minio

## 3. 模块添加顺序

### M0：工程基线与文档治理

目标：

- 计划、进度、冒烟文档必须真实反映代码状态。
- 每次完成模块都更新 `docs/PROGRESS.md` 和 `docs/SMOKE_ASSESSMENT.md`。

文件：

- `docs/PROJECT_PLAN.md`
- `docs/PROGRESS.md`
- `docs/SMOKE_ASSESSMENT.md`

完成门槛：

- 计划书存在并列出模块参考项目。
- 进度文档标明当前模块状态。
- 验证结果写入冒烟文档。

### M1：DocumentPatch 引擎

目标：

- 所有文档写入都必须走 `DocumentPatch -> apply -> validate -> persist`。

文件：

- `packages/doc-schema/src/patch/types.ts`
- `packages/doc-schema/src/patch/apply.ts`
- `packages/doc-schema/src/patch/block-tree.ts`
- `packages/doc-schema/src/patch/errors.ts`
- `packages/doc-schema/src/patch/index.ts`

必须支持：

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
- `apply_style_profile` 作为上层配置变更信号，不能伪造 AST 字段。

完成门槛：

- `applyDocumentPatches(doc, patches)` 返回新 `Doc`，不原地修改输入。
- 非法 parent、非法 index、节点不存在、移动到自身子树必须抛出可读错误。
- `pnpm --filter @black-bean-sprouts/doc-schema typecheck` 通过。
- `pnpm --filter @black-bean-sprouts/doc-schema build` 通过。

### M2：DocumentApplicationService

目标：

- 后端持久化文档前必须应用 patch 并校验 AST。

文件：

- `packages/server/src/services/documentApplication.ts`
- `packages/server/src/routes/document/index.ts`
- `packages/server/src/services/document.ts`

完成门槛：

- 新增 `PATCH /api/documents/:id/patches`。
- 写库前调用 `applyDocumentPatches` 与 `isValidDoc`。
- 非法 patch 不入库。

### M3：Agent 文档工具链

目标：

- `patch_document` 真正修改文档。
- Agent 工具只调用服务层，不直接碰 Prisma 细节。

文件：

- `packages/agent-runtime/src/tools/patch-document.ts`
- `packages/server/src/services/agent.ts`
- `packages/server/src/routes/agent/chat.ts`
- `packages/xiaolongxia-kernel/**`

完成门槛：

- mock LLM 触发 `patch_document` 后，数据库文档内容变化。
- SSE 输出 `document_patched`。
- `AgentMessage.toolCalls/toolResults` 落库。

### M4：真实小龙虾内核接入

目标：

- `xiaolongxia-kernel` 不再只是 legacy adapter。
- 小龙虾源码作为后端模块存在。

文件：

- `packages/xiaolongxia-kernel/**`
- `packages/server/src/services/xiaolongxia.ts`
- vendored OpenClaw 子模块或明确子包

完成门槛：

- 可以在仓库内看到真实 OpenClaw command/gateway/session 代码路径。
- 一轮 Agent 运行能证明事件来自 OpenClaw run lifecycle。
- `packages/agent-runtime/src/orchestrator/orchestrator.ts` 不再是 Agent 主链路。

### M5：前端 AST 编辑器

目标：

- 当前只读预览升级为 block editor。

文件：

- `packages/web/src/components/editor/DocumentEditorShell.vue`
- `packages/web/src/components/editor/BlockTreeEditor.vue`
- `packages/web/src/components/editor/BlockEditor.vue`
- `packages/web/src/components/editor/InlineTextEditor.vue`
- `packages/web/src/stores/document.ts`

完成门槛：

- 修改标题、章节、段落后刷新仍存在。
- 前端生成 `DocumentPatch[]`，不整体覆盖 AST。

### M6：渲染与 StyleProfile 闭环

目标：

- 文档导出由真实 `StyleProfile` 驱动。

文件：

- `packages/doc-engine/**`
- `packages/server/src/services/renderApplication.ts`
- `packages/server/src/routes/document/render.ts`

完成门槛：

- 同一文档使用两个样式导出有可观察差异。
- 引用列表、图片 asset 不再是占位文本。

### M7：队列、对象存储、后台权限

目标：

- 生产链路可运行，不把长任务绑在同步请求上。

文件：

- `packages/server/src/queues/**`
- `packages/server/src/workers/**`
- `packages/server/src/services/storage/**`
- `packages/server/src/plugins/auth.ts`
- `packages/server/src/routes/admin/**`
- `prisma/schema.prisma`

完成门槛：

- 渲染任务进入队列并异步完成。
- 导出结果进入对象存储。
- 普通用户不能访问 `/api/admin/*`。

### M8：测试与自动冒烟

目标：

- 每个核心链路可回归。

文件：

- `packages/*/tests/**`
- `scripts/smoke/**`
- CI 配置

完成门槛：

- typecheck、build、unit、无外部服务 smoke 可一键执行。
- `docs/SMOKE_ASSESSMENT.md` 能按脚本输出更新。

## 4. 固定开发规则

1. 涉及 Agent，必须先判断是否绕过 `xiaolongxia-kernel`。
2. 涉及文档写入，必须先判断是否绕过 `DocumentPatch`。
3. 涉及渲染，必须先判断是否绕过 `StyleProfile`。
4. 涉及前端编辑，必须生成 patch。
5. 每个模块完成后必须跑对应 package 的 `typecheck` 与 `build`。
6. 不能把未完成能力写成完成。
