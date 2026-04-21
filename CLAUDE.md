# CLAUDE.md — 黑豆芽 (Black Bean Sprouts) 项目规范

> 本文件是 Claude Code 的持久化指令，每次对话自动加载。

## 项目概述

医学文档排版 Agent 平台。核心架构：**Schema 定了不改，AST 是脊椎**。
MVP 先做毕业论文，架构支撑 SCI论文/项目申请书/调研报告/插图生成/文献检索等扩展。

## Monorepo 结构

```
black_bean_sprouts/
├── packages/doc-schema/       # AST + StyleProfile + Patch 类型定义 + TypeBox 运行时校验
├── packages/agent-runtime/    # Agent 运行时类型 (StreamEvent, ToolResult, LLMRouter, Observer)
├── packages/server/           # Fastify 后端
├── packages/web/              # Vue 3 + Vite + Naive UI 前端
├── prisma/                    # 数据库 Schema
└── CLAUDE.md                  # 本文件
```

## 核心编码规范

### 1. Schema Version 头部标注

每个 TypeScript 源文件**必须**在第一行标注当前使用的 schema 版本：

```typescript
// @doc-schema-version: 1.0.0
```

无例外的强制要求。新增文件也必须加。

### 2. 单文件不超过 3 个 class/interface/type

- 一个文件最多定义 **3 个** 导出的 class、interface 或 type
- 超过就拆文件
- 目的：小文件易于 review、易于 git diff、易于并行开发

**错误示例** — 一个文件塞了 7 个 interface：
```typescript
// person.ts — BAD
export interface Person { ... }
export interface Author extends Person { ... }
export interface Editor extends Person { ... }
export interface Reviewer extends Person { ... }
export interface Translator { ... }
export interface Organization { ... }
export interface Affiliation { ... }
```

**正确示例** — 拆到不同文件：
```typescript
// person.ts — GOOD (3个)
export interface Person { ... }

// reference.ts — GOOD (2个)
export type ReferenceType = ...
export interface ReferenceItem { ... }
```

### 3. 多文件少行数

- 每个文件控制在 **100 行以内**，理想状态 30-60 行
- 超过 100 行必须考虑拆分
- 用 barrel `index.ts` 做 re-export，对外暴露统一入口

### 4. 严格 TypeScript

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true
}
```

- **禁止 `any`**：用 `unknown` + 类型守卫，或定义具体类型
- **禁止非空断言 `!`**：用 optional chaining 或显式检查
- **禁止 `as` 类型断言**（除非性能关键路径且有注释说明原因）：用 type guard
- **用 `type` 而非 `interface` 做联合类型**，用 `interface` 做对象形状
- **导出的类型全部用 `export type`**（除非需要运行时值）
- **优先用 discriminated union**（每个变体都有 `type` 字段）让编译器穷举检查

编译器是最好的朋友 — 让它在编译阶段抓住错误，不要留到运行时。

```typescript
// GOOD — discriminated union，编译器穷举检查
type InlineNode =
  | Text
  | CitationRef
  | XRef;

function process(node: InlineNode) {
  switch (node.type) {
    case "text": return node.text;      // TypeScript 知道这里是 Text
    case "citation_ref": return node.attrs.refId;
    case "xref": return node.attrs.targetId;
    // 如果漏掉一个 case，开启 noUncheckedIndexedAccess 后编译器会警告
  }
}
```

```typescript
// BAD — any 逃逸
function process(node: any) {
  return node.text; // 编译器无法检查，运行时爆炸
}
```

### 5. Import 风格

- 使用 **`import type`** 导入纯类型
- 使用 **`import`** 导入运行时值
- 不使用 `import * as`

```typescript
import type { Person } from "./person";           // 纯类型
import { SCHEMA_VERSION } from "./version";        // 运行时值
import type { InlineNode } from "../inline";       // 纯类型
```

## AST 架构原则

### Schema 定了不改

- `doc-schema` 包的 AST 结构一旦冻结为 v1.0.0，**不修改已有字段**
- 需要扩展时加新字段（optional），不删不改旧字段
- 版本号写在 `version.ts` 的 `SCHEMA_VERSION` 常量

### 文档级资源池

```
Doc
├── attrs (DocMeta)
├── content: BlockNode[]          ← 树结构
├── references: Record<string, ReferenceItem>   ← 资源池，不在树里
├── assets: Record<string, AssetRef>            ← 资源池
└── footnotes: Record<string, InlineNode[]>     ← 资源池
```

Agent 添加引用直接 put 到资源池，不用遍历 AST。

### 语义/样式分离

- Block 节点只记语义（`role: "caption"`），不记样式（`fontSize: 14`）
- 样式全部在 `StyleProfile` 里配置，渲染器按 profile 渲染
- `overrides` 是逃生舱，仅在真的要突破样式时用

## TypeBox 运行时校验

- 每个 TypeScript 类型都有对应的 TypeBox schema（`schemas/` 目录）
- Agent 从 LLM 输出的任何 JSON，**必须**经过 TypeBox schema 校验后才能应用到文档
- **不校验 = 没 schema**

## 常用命令

```bash
pnpm install                  # 安装依赖
pnpm build                    # 构建所有包
pnpm lint                     # ESLint 检查
pnpm typecheck                # TypeScript 类型检查
pnpm dev:schema               # doc-schema watch 模式
pnpm dev:server               # server 开发模式
pnpm dev:web                  # 前端开发模式
```

## Git 规范

- Commit message 用英文，格式：`type: description`
- type: feat / fix / refactor / chore / docs / style / test
- 一个 commit 做一件事
- 不要 commit `dist/`、`node_modules/`、`.env`、`.claude/`

## 阶段完成标准 (Phase Completion Criteria)

**一个阶段"做完"的定义不是"代码写完"，而是"全部检查通过"。**

每个 Phase 必须通过以下检查才算完成：

### 1. 编译检查 (必须)
```bash
pnpm typecheck          # 所有包零 TS 错误
pnpm build              # 所有包 build 成功
```

### 2. 功能验证 (必须)
根据阶段内容，运行对应的功能测试：
- **doc-schema**: 写一段测试脚本，构造一个完整 Doc AST JSON，用 TypeBox validator 校验通过
- **doc-engine**: 构造一个最小 AST，调用 DocxRenderer.render()，确认生成 .docx Buffer 不为空
- **agent-runtime**: 构造 mock LLMProvider + ToolRegistry，运行 Orchestrator 一轮，确认 StreamEvent 正确产出
- **server**: `pnpm dev:server` 启动不报错，health endpoint 返回 200
- **web**: `pnpm dev:web` 启动不报错，页面可渲染

### 3. 代码规范检查 (必须)
- 所有 `.ts` 文件头部有 schema version 注释（doc-schema 包内）
- 单文件不超过 3 个导出 class/interface/type
- 无 `any`、无 `!` 非空断言
- `import type` 用于纯类型导入

### 4. 文档更新 (必须)
- 更新 `docs/PROGRESS.md` 进度文档
- 标注每个 Phase 的状态：`DONE` / `IN PROGRESS` / `TODO`
- 记录已知问题和下一步

### 5. Git 提交 (必须)
- 通过以上全部检查后才 commit + push
- Commit message 包含检查结果概要

**原则：没通过功能验证 = 没做完。写完代码不等于做完阶段。**

## 技术栈

- Runtime: Node.js 20+, pnpm 9+
- Language: TypeScript 5.7+ (strict)
- Backend: Fastify 5 + Prisma 6 + PostgreSQL
- Frontend: Vue 3 + Vite 6 + Naive UI + Tiptap
- Queue: BullMQ + Redis
- Storage: MinIO
- Agent: MiniMax / DeepSeek / Anthropic (LLMRouter 降级链)
- Citation: citeproc-js + CSL
