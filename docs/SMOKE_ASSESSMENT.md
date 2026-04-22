# 冒烟测试评估

> 最后更新：2026-04-22  
> 只记录已经实际执行并通过的命令。未执行的能力不写成 PASS。

## 1. 本轮实际执行的命令

| 命令 | 结果 | 说明 |
|---|---:|---|
| `pnpm db:push` | PASS* | PostgreSQL 可连接，schema 已同步；Prisma generate 在 Windows 上出现 DLL rename 警告，但不影响本轮验证 |
| `pnpm smoke` | PASS | 一键跑通 doc-schema / agent-runtime / doc-engine / patch API / agent patch 五条 smoke |
| `pnpm typecheck` | PASS | 全 workspace 类型检查通过 |
| `pnpm build` | PASS | 全 workspace 构建通过 |
| `Invoke-WebRequest http://127.0.0.1:4000/api/health` | PASS | 后端开发服务返回 `{"status":"ok"}` |
| `Invoke-WebRequest http://127.0.0.1:5173/` | PASS | 前端开发服务返回 HTTP 200 |

## 2. `pnpm smoke` 细项拆解

| 子项 | 命令 | 结果 | 核验点 |
|---|---|---:|---|
| DocumentPatch 引擎 | `pnpm --filter @black-bean-sprouts/doc-schema smoke:patch` | PASS | 插入、移动、文本更新、meta 更新、meta 清空、reference/asset 写入 |
| Agent tool 链 | `pnpm --filter @black-bean-sprouts/agent-runtime smoke:patch-tool` | PASS | `patch_document` 会把 patch 转发到服务层 |
| DOCX 渲染 | `pnpm run smoke:doc-engine` | PASS | `DocxRenderer.render()` 产出非空 DOCX buffer，ZIP magic bytes 正确 |
| Patch API 写库 | `pnpm run smoke:document-patch-api` | PASS | `PATCH /api/documents/:id/patches` 真实写库，标题列同步，section 插入成功 |
| Agent 端到端写库 | `pnpm run smoke:agent-patch` | PASS | `/api/agent/chat` 触发 mock provider，SSE 事件完整，DB 文档被真实修改 |

## 3. 模块级结论

### `packages/doc-schema`

**状态：PASS**

已验证：

- `DocumentPatch[]` 应用链可用
- 非法移动仍会抛错
- `update_meta` 支持字段删除（`null => delete`）

结论：

- 作为文档写入底座，当前可继续扩展，不需要返工主模型。

### `packages/server`

**状态：PASS**

已验证：

- `PATCH /api/documents/:id/patches`
- `POST /api/agent/chat`
- `GET /api/health`
- Prisma 实际写库
- `Document.title / meta / content` 同步

结论：

- server 的 patch 写入链已经不是“看起来可用”，而是“真实写库可用”。

### `packages/agent-runtime`

**状态：PASS（过渡层）**

已验证：

- `patch_document` 工具校验与转发链可用
- orchestrator 能驱动工具调用并产出事件

限制：

- 它仍然不是最终的小龙虾 / OpenClaw 内核，只是当前过渡执行层。

### `packages/xiaolongxia-kernel`

**状态：PASS（边界层） / PARTIAL（目标态）**

已验证：

- `kernel_session`
- `kernel_lifecycle`
- `workingMemory.kernel.*` 持久化
- mock provider 驱动真实文档 patch

仍未验证：

- 真实 OpenClaw `agent-command / gateway / session-store` 代码主链

### `packages/doc-engine`

**状态：PASS**

已验证：

- 最小 Doc AST -> DOCX 输出

仍未验证：

- `StyleProfile` 真实影响导出结果
- 真实 asset/reference/citation 渲染闭环

### `packages/web`

**状态：PASS WITH WARNING**

已验证：

- `vue-tsc --noEmit`
- `vite build`
- `vite` 开发服务 HTTP 200
- 新文档页 patch-first UI 构建通过

警告：

- 主 chunk 仍偏大，`vite build` 有 chunk size warning。

## 4. 当前仍然不能宣称完成的能力

- 真实 OpenClaw command/gateway 深接入
- 真实 OpenAI-compatible 模型联调
- BullMQ/Redis 长任务队列
- MinIO 导出结果存储
- 复杂块 UI（figure/table/formula/cover）
- StyleProfile 驱动的完整排版闭环

## 5. 结论

本轮之后，项目已经从“类型通过但核心链未闭环”推进到：

1. 文档 patch 写库真实可用
2. Agent patch 文档真实可用
3. Apple 风格 patch-first 编辑器真实可用
4. 前后端开发服务可启动

当前最大的剩余问题，不再是“文档改不了”，而是“OpenClaw 深接入、渲染闭环、生产链路”还没有完成。
