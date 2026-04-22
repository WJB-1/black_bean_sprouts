# 冒烟测试评估 — 2026-04-22

## 本次复核范围

- 需求基线：`CLAUDE.md`、`docs/PROGRESS.md`
- 代码复核：`packages/doc-schema`、`packages/doc-engine`、`packages/agent-runtime`、`packages/server`、`packages/web`
- 本次重点修复：
  - 文档创建接口与前端 `docTypeId` / `docTypeCode` 契约错位
  - Prisma 使用 `cuid()`，后端却按 `ObjectId` 校验
  - 前端导出 Word 未传请求体，命中渲染接口 schema 风险
  - 登录跳转链路丢失 redirect
  - Agent SSE 事件解析与错误处理不完整
  - `doc-schema` 产物 ESM import 缺少 `.js` 后缀，导致 runtime validator 不能被 Node 直接执行
  - 前端界面整体老旧且存在多处乱码，已重写为 Apple 风格

## 结果总览

| 模块 | 验证方式 | 结果 | 结论 |
|---|---|---:|---|
| `all` | `pnpm typecheck` | PASS | 5 个 workspace 包类型检查通过 |
| `all` | `pnpm build` | PASS | 5 个 workspace 包构建通过 |
| `doc-schema` | Node 直接运行 `dist` runtime validator | PASS | 完整 Doc AST 可通过 TypeBox + AJV 校验 |
| `doc-engine` | 最小文档渲染 `.docx` | PASS | 输出 `8530 bytes`，魔数为 `PK` |
| `agent-runtime` | 基础 orchestrator 冒烟 | PASS | 产出 `message_delta` 与 `done` |
| `agent-runtime` | tool-call orchestrator 冒烟 | PASS | 产出 `tool_call_start/result` 与 `done` |
| `server` | 源码启动 + `/api/health` | PASS | 本地源码服务返回 `200` |
| `web` | Vite dev server + 首页 HTML | PASS | 首页返回 `<div id="app"></div>` |

## 模块评估

### 1. `packages/doc-schema`

**状态：PASS**

- 已统一把源码内相对 import/export specifier 改为 `.js` 后缀。
- `tsc --noEmit` 和 `tsc -p tsconfig.build.json` 均通过。
- `dist/index.js` 可被 Node ESM 直接导入，runtime validator 可验证完整 Doc AST。

### 2. `packages/doc-engine`

**状态：PASS**

- 最小 AST 可成功渲染 `.docx`。
- 输出 buffer 非空，且 ZIP / Word 魔数正确。

### 3. `packages/agent-runtime`

**状态：PASS**

- 基础对话流正确输出 `message_delta → done`。
- 工具调用流正确输出 `tool_call_start → tool_call_result → done`。

### 4. `packages/server`

**状态：PASS**

- 修复 `cuid()` / `ObjectId` 不匹配问题，文档路由不再错误拒绝合法 ID。
- 文档创建改为同时接受 `docType id` 或 `docType code`，与前端新建流程对齐。
- 微信登录增加 redirect 透传。
- 渲染接口默认样式中的中文字体名、图表编号格式已恢复正常文本。
- 源码启动后 `/api/health` 返回 `200`。

### 5. `packages/web`

**状态：PASS**

- 登录页、文档列表页、编辑页、后台页全部改成统一 Apple 风格界面。
- 删除前端手写 AST 类型副本，改为直接使用 `@black-bean-sprouts/doc-schema` 类型。
- 修复聊天流事件解析：`session_created`、`tool_call_start`、`tool_call_result`、`error`。
- 修复登录体验：401 自动回跳登录页并保留 redirect，微信登录保留目标页面。
- Vite dev server 可启动，首页 HTML 可获取。

## 剩余风险

- 本次没有启动真实 PostgreSQL / Redis / MinIO，因此数据库持久化、队列、对象存储仍属于未覆盖外部依赖。
- 微信 OAuth、真实 LLM API、外部短信服务仍需在真实配置环境下做联调。
- 前端当前是“只读预览 + Agent 协作”模型，不是完整 WYSIWYG 编辑器。
- Web build 仍提示主 chunk 超过 500KB，可后续用 Naive UI / Vue 路由拆包优化。
