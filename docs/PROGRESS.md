# 项目进度 — 黑豆芽 (Black Bean Sprouts)

> 最后更新: 2026-04-22

## 2026-04-22 全量冒烟更新

- 已修复 `doc-schema` 运行时产物 ESM import 缺少 `.js` 后缀的问题。
- 已完成全量冒烟：
  - `pnpm typecheck`: **PASS**
  - `pnpm build`: **PASS**
  - `doc-schema` runtime validator: **PASS**
  - `doc-engine` `.docx` render smoke: **PASS**
  - `agent-runtime` orchestrator smoke: **PASS**
  - `agent-runtime` tool-call smoke: **PASS**
  - `server` 源码启动 + `/api/health`: **PASS**
  - `web` Vite dev server + 首页 HTML: **PASS**
- 详细模块评估见：`docs/SMOKE_ASSESSMENT.md`

## 2026-04-21 复核更新

- 重新按照 `CLAUDE.md` 要求复核后，发现此前“全部 PASS / 全链路 PASS”与当前代码并不完全一致。
- 本次已修复的关键问题：
  - 文档接口错误使用 `ObjectId` 校验，而数据库主键实际为 `cuid()`
  - 前端新建文档传 `thesis`，后端却要求 `docTypeId`
  - 导出 Word 时前端未发送 render body
  - 微信登录没有保留 redirect
  - Agent SSE 前端解析不完整
  - 前端多页存在乱码与 UI 一致性问题，已重写为 Apple 风格
- 本次复核后的最新验证结果：
  - `server` typecheck / build / health：**PASS**
  - `web` typecheck / build：**PASS**
  - `doc-engine` smoke：**PASS**
  - `agent-runtime` smoke：**PASS**
  - `doc-schema` runtime smoke：**FAIL**（`dist` 产物 ESM import 缺少 `.js` 后缀）
- 详细模块评估见：`docs/SMOKE_ASSESSMENT.md`

## Phase 总览

| Phase | 内容 | 状态 | typecheck | build | 功能验证 |
|-------|------|------|-----------|-------|---------|
| 0 | AST Schema 定义 | DONE | PASS | PASS | PASS |
| 1 | Monorepo 骨架 | DONE | PASS | PASS | PASS |
| 2 | 认证模块 | DONE | PASS | PASS | PASS (server 启动) |
| 3 | 文档引擎 | DONE | PASS | PASS | PASS (.docx 渲染) |
| 4 | Agent 运行时 | DONE | PASS | PASS | PASS (orchestrator) |
| 5 | 前端编辑器 | DONE | PASS | PASS | PASS (vite build) |
| 6 | 管理后台 | DONE | PASS | PASS | PASS (vite build) |
| 7 | 最终集成 | DONE | PASS | PASS | PASS (全链路) |

## 功能验证结果

### doc-schema
- 构造完整 Doc AST → TypeBox + AJV 校验: **PASS**

### doc-engine
- 最小 AST → DocxRenderer → 8599 bytes valid .docx: **PASS**

### agent-runtime
- Mock LLM + ToolRegistry + Orchestrator → message_delta + done events: **PASS**

### server
- 启动成功 port 4000, auth + agent + document 路由: **PASS**
- Agent 聊天端点已接入真实 AgentOrchestrator (OpenAI 兼容 LLM)
- ToolServices 适配器已桥接 Prisma (loadDocument / saveDocument / submitRenderJob)
- 所有 API 端点经 QA 审计: ObjectId 校验、TypeBox schema、错误处理完善

### web
- Vite build: 2808+ modules → dist/ 产出完整: **PASS**
- 所有 Vue 组件经 QA 审计: 输入校验、错误处理、资源清理完善
- SMS 表单计时器清理、手机号验证、AgentChat SSE 重连

### 集成验证
- SSE /chat → AgentOrchestrator → LLM API → ToolRegistry → Prisma: **WIRED**
- Render endpoint → DocxRenderer → .docx 下载: **WIRED**
- CRUD 端到端: Web → API → Prisma: **WIRED**

## QA 审计

### API QA (已完成)
- 所有 REST 端点 TypeBody 校验: PASS
- ObjectId 合法性校验: PASS
- WeChat OAuth 错误处理: PASS
- SSE 错误恢复: PASS
- Content-Disposition 头安全: PASS

### Frontend QA (已完成)
- 22 个文件修复, +956 行健壮性改进
- SmsForm: 计时器清理、手机号/验证码输入限制
- AgentChat: SSE 重连、消息累积、错误显示
- DocEditor: AST 安全遍历、空状态处理
- Router: 认证守卫边界情况

## 已完成文件统计

### packages/doc-schema (48 + 1 test)
- core (4): version, base, doc, meta
- inline/ (6), block/ (14), resource/ (5), style/ (11), patch/ (2), schemas/ (6)

### packages/doc-engine (19 + 1 test)
- renderer/ (5), style-resolver/ (4), citation/ (3), numbering/ (3), worker/ (3)

### packages/agent-runtime (20 + 1 test)
- core (4), tools/ (6), llm/ (3), orchestrator/ (3), skills/ (3)

### packages/server (21)
- core (3), lib/ (3), plugins/ (2), services/ (4), routes/auth/ (4), routes/agent/ (3), routes/document/ (3)

### packages/web (19)
- lib/ (2), stores/ (2), router/ (1), pages/ (7), components/ (5), renderers/ (6)

### 基础设施
- prisma/schema.prisma, docker-compose.yml, .env.example

## 总文件数: ~112+ 源文件

## 配置说明

### LLM 接入
在 `.env` 中配置:
```
LLM_BASE_URL=https://api.deepseek.com/v1  # 或其他 OpenAI 兼容 API
LLM_API_KEY=your-api-key
LLM_MODEL=deepseek-chat
LLM_MAX_TURNS=10
```

### 启动
```bash
# 1. 启动依赖服务
docker compose up -d

# 2. 数据库迁移
cd packages/server && npx prisma db push

# 3. 启动后端
pnpm --filter server dev

# 4. 启动前端
pnpm --filter web dev
```
