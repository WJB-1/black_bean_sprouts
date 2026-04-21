# 项目进度 — 黑豆芽 (Black Bean Sprouts)

> 最后更新: 2026-04-21

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

### web
- Vite build: 2808 modules → dist/ 产出完整: **PASS**

## 已完成文件统计

### packages/doc-schema (48 + 1 test)
- core (4): version, base, doc, meta
- inline/ (6), block/ (14), resource/ (5), style/ (11), patch/ (2), schemas/ (6)

### packages/doc-engine (19 + 1 test)
- renderer/ (5), style-resolver/ (4), citation/ (3), numbering/ (3), worker/ (3)

### packages/agent-runtime (20 + 1 test)
- core (4), tools/ (6), llm/ (3), orchestrator/ (3), skills/ (3)

### packages/server (20)
- core (3), lib/ (3), plugins/ (2), services/ (3), routes/auth/ (4), routes/agent/ (3), routes/document/ (3)

### packages/web (19)
- lib/ (2), stores/ (2), router/ (1), pages/ (7), components/ (5), renderers/ (6)

### 基础设施
- prisma/schema.prisma, docker-compose.yml, .env.example

## 总文件数: ~110+ 源文件
