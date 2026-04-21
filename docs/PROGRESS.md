# 项目进度 — 黑豆芽 (Black Bean Sprouts)

> 最后更新: 2026-04-21

## Phase 总览

| Phase | 内容 | 状态 | typecheck | build | 功能验证 |
|-------|------|------|-----------|-------|---------|
| 0 | AST Schema 定义 | DONE | PASS | PASS | PASS |
| 1 | Monorepo 骨架 | DONE | PASS | PASS | PASS |
| 2 | 认证模块 | DONE | PASS | PASS | PASS (server 启动正常) |
| 3 | 文档引擎 | DONE | PASS | PASS | PASS (渲染 8599 bytes .docx) |
| 4 | Agent 运行时 | DONE | PASS | PASS | PASS (orchestrator mock 运行正常) |
| 5 | 前端编辑器 | TODO | — | — | — |
| 6 | 管理后台 | TODO | — | — | — |

## 功能验证结果

### doc-schema
- 构造完整 Doc AST (含 section, paragraph, figure, table, reference)
- TypeBox + AJV 校验通过: **PASS**

### doc-engine
- 最小 AST → DocxRenderer.render() → 8599 bytes .docx
- ZIP magic bytes (PK) 验证: **PASS**

### agent-runtime
- Mock LLMProvider + ToolRegistry + AgentOrchestrator
- 产出 events: message_delta, done
- **PASS**

### server + web
- Server: 启动成功, 监听 port 4000
- Web: Vite build 成功 (2808 modules, 2.20s, dist/ 产出 index.html + assets)
- **PASS**

## 已完成文件统计

### packages/doc-schema (48 files + 1 test)
- version, base, doc, meta (4 核心文件)
- inline/ (6): text, citation-ref, xref, inline-formula, footnote-ref, index
- block/ (14): section, paragraph, figure, table, formula, cover, abstract, toc, acknowledgements, declaration, appendix, ref-list-placeholder, page-break, index
- resource/ (5): person, reference, asset-ref, footnote, index
- style/ (11): profile, fonts, numbering, section-style, paragraph-style, figure-style, table-style, abstract-style, cover-style, citation-style, index
- patch/ (2): types, index
- schemas/ (6): doc-schema, block-schemas, inline-schemas, resource-schemas, style-schemas, validators
- tests/ (1): schema-test

### packages/doc-engine (19 files + 1 test)
- renderer/ (5): types, inline-renderer, block-renderer, docx-renderer, index
- style-resolver/ (4): defaults, merge, resolver, index
- citation/ (3): types, formatter, index
- numbering/ (3): types, resolver, index
- worker/ (3): types, render-worker, index
- tests/ (1): render-test

### packages/agent-runtime (20 files + 1 test)
- types, working-memory, observer, llm-router (4)
- tools/ (6): types, registry, patch-document, query-document, render-document, index
- llm/ (3): types, openai-compat, index
- orchestrator/ (3): types, orchestrator, index
- skills/ (3): types, thesis, index
- tests/ (1): orchestrator-test

### packages/server (16 files)
- env, app, index (3)
- lib/ (3): prisma, errors, token
- plugins/ (2): auth, cors
- services/ (2): sms, user
- routes/auth/ (4): sms, wechat, me, index
- routes/agent/ (3): chat, session, index

### packages/web (8 files + dist/)
- lib/ (2): token, api
- stores/ (1): auth
- router/ (1): index
- pages/ (2): LoginPage, HomePage
- components/ (1): SmsForm

### 基础设施
- prisma/schema.prisma (9 models, 4 enums)
- docker-compose.yml (PostgreSQL + Redis + MinIO)
- .env.example / .env

## 下一步
1. Phase 5: 前端 Tiptap 编辑器 + Agent 对话面板
2. Phase 6: 管理后台 + 打磨
