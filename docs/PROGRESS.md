# 黑豆芽开发进度

> 最后更新：2026-04-22  
> 本文件只记录真实进度。完整计划见 `docs/PROJECT_PLAN.md`。  
> 小龙虾 / OpenClaw 是 Agent 后端内核，不是参考项目；其他模块按计划书中的参考矩阵分别实现。

## 0. 当前真实状态

### 已完成基线

- 已新增 `packages/xiaolongxia-kernel`，作为小龙虾内核接入边界。
- `/api/agent/chat` 已改为通过 `createXiaolongxiaRuntime()` 进入内核边界。
- Agent session 已保存 `workingMemory.kernel.sessionKey`、`skillsSnapshot`、`agentId`、`lastRunId`。
- Agent session 详情路由已取消 24 位 hex 伪校验，改为兼容 Prisma `cuid()`。
- `pnpm typecheck` 通过。
- `pnpm build` 通过。
- 后端启动后 `GET /api/health` 返回 `{"status":"ok"}`。

### 不能宣称完成

- `xiaolongxia-kernel` 目前仍使用 `LegacyAgentRuntimeAdapter`，还没有接入真实 OpenClaw command/gateway。
- `patch_document` 仍未真正应用 `DocumentPatch`。
- 前端仍不是 AST block editor。
- 渲染队列、对象存储、后台权限仍未闭环。
- 真实 LLM、PostgreSQL 写库、Redis、MinIO 端到端链路仍需独立 smoke。

## 1. 模块进度

| 模块 | 状态 | 当前结论 |
|---|---|---|
| M0 工程基线与文档治理 | DONE | `PROJECT_PLAN` 已新增；本文件已改为模块进度制 |
| M1 DocumentPatch 引擎 | DONE | `applyDocumentPatches` 已实现，patch smoke 通过 |
| M2 DocumentApplicationService | IN PROGRESS | `applyPatchesToDocument` 与 `PATCH /api/documents/:id/patches` 已新增；数据库端到端 smoke 待跑 |
| M3 Agent 文档工具链 | TODO | 等 M2 数据库 smoke 后修复 `patch_document` 真改文档 |
| M4 真实小龙虾内核接入 | TODO | 需要 vendoring/抽取 OpenClaw command/gateway/session |
| M5 前端 AST 编辑器 | TODO | 等 M1/M2 patch API 稳定后做 |
| M6 渲染与 StyleProfile 闭环 | TODO | 等文档写入链稳定后做 |
| M7 队列、对象存储、后台权限 | TODO | 渲染与权限生产化 |
| M8 测试与自动冒烟 | TODO | 每个模块逐步补齐 |

## 2. 已完成：M1 DocumentPatch 引擎

目标：

```text
Doc + DocumentPatch[]
  -> applyDocumentPatches
  -> next Doc
  -> isValidDoc(nextDoc)
  -> server persist
  -> Agent/Web 同一条写入链
```

已落地：

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
- `apply_style_profile` 暂时作为 no-op AST 操作，保留给 server 配置层处理。
- `packages/doc-schema/tests/patch-test.mjs` 覆盖插入、移动、文本更新、meta、reference、asset 和非法移动。

验证结果：

- `pnpm --filter @black-bean-sprouts/doc-schema typecheck` 通过。
- `pnpm --filter @black-bean-sprouts/doc-schema build` 通过。
- `pnpm --filter @black-bean-sprouts/doc-schema smoke:patch` 通过。

## 3. 当前正在做：M2 DocumentApplicationService

已落地：

- 新增 `packages/server/src/services/documentApplication.ts`。
- 新增 `applyPatchesToDocument`。
- 新增 `PATCH /api/documents/:id/patches`。
- `updateDocumentContent` 写入前会校验 `isValidDoc`。

还必须完成：

- 启动 PostgreSQL 后跑文档创建 + patch API 写库 smoke。
- 为 `patches` 增加运行时 schema 校验，不能只依赖 TypeScript 类型。
- 改造 Agent `patch_document` 工具调用 `applyPatchesToDocument`。

## 4. 后续执行顺序

1. 跑 M2 数据库端到端 patch API smoke。
2. 改造 M3 `patch_document` 工具，让 Agent 真改文档。
3. 再推进 M4 真实 OpenClaw command/gateway 接入。
4. 等后端写入稳定后重建 M5 前端 AST 编辑器。

## 5. 固定要求

- 涉及 Agent：不得绕过 `packages/xiaolongxia-kernel`。
- 涉及文档写入：不得绕过 `DocumentPatch`。
- 涉及渲染：不得绕过 `StyleProfile`。
- 涉及前端编辑：不得整体覆盖 AST，必须生成 patch。
- 每次模块完成都更新 `docs/PROGRESS.md` 和 `docs/SMOKE_ASSESSMENT.md`。

## 2026-04-22 检查点补记

### M3 `patch_document` 工具链

- `packages/agent-runtime/src/tools/patch-document.ts` 已改为在执行前校验 `DocumentPatch[]`。
- `packages/server/src/services/agent.ts` 已把工具层 patch 请求接到 `applyPatchesToDocument(...)`。
- `packages/server/src/routes/document/index.ts` 已对 `PATCH /api/documents/:id/patches` 使用 `DocumentPatchArraySchema`。
- `packages/doc-schema/src/schemas/patch-schemas.ts` 已新增运行时 patch schema，供 server / agent 共用。
- `packages/agent-runtime/tests/patch-document-tool-test.mjs` 已新增冒烟，确认工具会把 patch 转发到服务层。

### 工程链路修复

- 已确认真正问题是：workspace 内部包默认解析到上游 `dist`，不是源码。
- 这会导致 `clean` 后直接执行 `server dev` / `typecheck` 时，因为缺少上游 `dist` 而失败。
- 已验证把内部包直接映射到 sibling `src` 会触发 `rootDir` / `TS6307` 跨包错误，因此暂不采用该方案。
- 先落地低风险修复：新增根脚本 `build:libs`，并让根 `typecheck` 与 `server predev` 先补齐内部库产物。
- 所有包的 `clean` 脚本已切到 `rimraf`，并显式清理 `dist` 与 `tsbuildinfo`，避免 Windows 下通配符/壳差异导致残留。
