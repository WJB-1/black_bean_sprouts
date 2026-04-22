# 冒烟测试评估

> 最后更新：2026-04-22  
> 本次评估只记录已经执行过的检查，不把未验证能力写成完成。

## 本次复核重点

- 修正“小龙虾 / OpenClaw 是参考项目”的错误表述。
- 新增 `packages/xiaolongxia-kernel`，作为后端 Agent 内核模块边界。
- `/api/agent/chat` 不再直接构造 `AgentOrchestrator`、`ToolRegistry`、`OpenAICompatProvider`。
- Agent session 增加内核语义：
  - `sessionKey`
  - `skillsSnapshot`
  - `agentId`
  - `lastRunId`
- 修复 Agent session 路由仍按 24 位 hex 校验的错误。
- 重写 `docs/PROGRESS.md`，把后续计划改成“恢复真实小龙虾内核”的执行文档。

## 已执行命令

| 命令 | 结果 | 说明 |
|---|---:|---|
| `pnpm --filter @black-bean-sprouts/xiaolongxia-kernel typecheck` | PASS | 新内核边界包类型检查通过 |
| `pnpm --filter @black-bean-sprouts/xiaolongxia-kernel build` | PASS | 生成 `dist` 类型与 JS 产物，供 server workspace 解析 |
| `pnpm --filter @black-bean-sprouts/server typecheck` | PASS | server 路由重接线后类型检查通过 |
| `pnpm typecheck` | PASS | 全 workspace TypeScript 检查通过 |
| `pnpm build` | PASS | 全 workspace 构建通过 |
| 后端启动 + `GET /api/health` | PASS | 通过受控后台 job 启动 `@black-bean-sprouts/server`，健康检查返回 `{"status":"ok"}` |

构建警告：

- `packages/web` 的主 chunk 仍超过 500KB。这是性能优化警告，不阻断构建；后续需要拆包。

## 模块评估

### `packages/xiaolongxia-kernel`

**状态：PARTIAL / 可编译，但还不是完整 OpenClaw command 内核**

已完成：

- 建立独立 workspace 包。
- 定义 `KernelSessionEntry`、`KernelIngress`、`KernelRuntime`、`KernelEvent`。
- 实现 OpenClaw 风格 `agent:<agentId>:...` 会话键。
- 实现 `skillsSnapshot` 固化。
- 实现 `workingMemory.kernel` 读写。
- 提供 `LegacyAgentRuntimeAdapter` 作为过渡适配层。

未完成：

- 尚未 vendoring / 接入 `OpenClaw src/agents/agent-command.ts`。
- 尚未走 `agentCommandFromIngress` 或 gateway server method。
- 还没有真实 OpenClaw run lifecycle、session store、tool event bus。

### `packages/server`

**状态：PASS / 静态与构建通过，运行时外部依赖未测**

已完成：

- `/api/agent/chat` 改为通过 `createXiaolongxiaRuntime()` 运行。
- route 不再直接 new 自定义 orchestrator。
- 后端启动后 `/api/health` 返回 `200` 和 `{"status":"ok"}`。
- 创建/加载 Agent session 时校验用户与文档归属。
- 新建 session 必须有合法 `documentId`，不再写入 `"none"` 这种无效外键。
- `AgentSession.workingMemory.kernel` 会保存内核元数据。
- 会话详情路由不再按 Mongo ObjectId/24 hex 校验。
- 避免把当前用户消息在 history 与 userMessage 中重复喂给内核。

未完成：

- 没有启动真实 PostgreSQL 做端到端写库验证。
- 没有真实 LLM key 时只能验证降级错误处理，不能证明模型调用成功。
- `patch_document` 仍未真正应用 `DocumentPatch`。

### `packages/agent-runtime`

**状态：LEGACY / 只能作为过渡，不是小龙虾内核**

事实：

- 当前仍被 `xiaolongxia-kernel` 的 `LegacyAgentRuntimeAdapter` 调用。
- 这只是为了不让 `/api/agent/chat` 立即断掉。
- 后续必须被真实 OpenClaw command/gateway 路径替换。

风险：

- `patchDocumentTool` 仍保存原文档，未应用 patch。
- `AgentOrchestrator` 不具备 OpenClaw 的 session store、skills snapshot、run lifecycle、gateway event 体系。

### `packages/doc-schema`

**状态：PASS / 本次全量 typecheck/build 通过**

未新增行为测试。本次只确认现有包没有因新增内核包和 server 重接线而构建失败。

### `packages/doc-engine`

**状态：PASS / 本次全量 typecheck/build 通过**

未新增渲染 smoke。本次只确认构建链路通过。

### `packages/web`

**状态：PASS WITH WARNING / 构建通过但主 chunk 过大**

已验证：

- `vue-tsc --noEmit` 通过。
- `vite build` 通过。

风险：

- 主 chunk 超过 500KB。
- 前端仍不是 AST block editor。
- Agent patch 后的文档刷新链路仍需端到端验证。

## 当前不能宣称完成的能力

- 真实小龙虾/OpenClaw command 内核接入。
- Agent 真实修改文档。
- 全量数据库端到端冒烟。
- 真实 LLM API 联调。
- Redis/BullMQ/MinIO 生产链路。
- 前端 AST 编辑器。

## 下一轮冒烟必须覆盖

1. 启动 PostgreSQL 后，创建文档并调用 `/api/agent/chat`。
2. 验证 `AgentSession.workingMemory.kernel.sessionKey` 与 `skillsSnapshot` 写入数据库。
3. 用 mock LLM 触发 `patch_document`，证明当前仍不会修改文档，然后修复。
4. 接入真实 OpenClaw command 路径后，证明 SSE 事件来自 OpenClaw run lifecycle。
5. 前端收到 `kernel_session`、`document_patched`、`done` 后行为正确。
