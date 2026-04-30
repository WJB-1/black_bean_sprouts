# OpenClaw 架构接入总结 — 架构师视角

> 撰写日期：2026-04-25  
> 范围：`black_bean_sprouts` 仓库内所有基于 OpenClaw 的开发成果  
> 读者：继续开发或评审本项目的架构师 / Tech Lead

---

## 1. 总体判断

**OpenClaw 在黑豆芽中的集成，已经完成了一套相对干净的“端口-适配器 + 动态加载”架构，但尚未成为默认主链。**

当前状态可以概括为：
- **架构设计质量：良好** — `xiaolongxia-kernel` 实现了标准的六边形端口-适配器模式，server 层通过 `KernelRuntime` 抽象消费，路由层无直接耦合。
- **运行状态：默认关闭** — 无论是 Agent Chat 还是 Workbench AI 结构化，默认都未走 OpenClaw 真实内核，而是分别走 Fake Kernel 和 SiliconFlow 直连。
- **工程债务：已收口，主要遗留是“默认未开”和“外部路径依赖”** — 不存在开发手册 v2 中描述的 `AgentOrchestrator` 直接实例化问题（该债务在实际代码中已消除，见第 5 节）。

---

## 2. 已完成的开发成果（分层总结）

### 2.1 端口-适配器层 — `packages/xiaolongxia-kernel`

这是整个 OpenClaw 接入最干净的部分，完全零依赖，可作为独立模块理解。

| 模块 | 职责 | 状态 |
|---|---|---|
| `ports/openclaw-port.ts` | 定义 `OpenClawPort` 接口：`run(input) → AsyncGenerator<KernelEvent>` | ✅ 稳定 |
| `runtime.ts` | `createKernelRuntime(port)` — 将 `OpenClawPort` 包装为 `KernelRuntime` | ✅ 稳定 |
| `adapters/openclaw-adapter.ts` | **真实适配器**：将回调式的 `OpenClawAgentRunner` 桥接为 async generator | ✅ 稳定 |
| `adapters/fake-openclaw-kernel.ts` | **Fake 适配器**：返回硬编码 lifecycle + assistant 事件，用于开发与测试 | ✅ 稳定 |
| `adapters/event-mapper.ts` | `mapOpenClawEvent(raw)` — 将原始 OpenClaw 事件归一化为 `KernelEvent` | ✅ 稳定 |

**设计亮点：**
- `KernelEvent` 是跨包标准事件模型，包含 `lifecycle`、`tool`、`assistant`、`patch`、`error` 等流类型。
- 真实适配器使用数组缓冲 + Promise 唤醒机制，优雅地解决了“回调 → async generator”的阻抗失配。
- Fake 适配器支持注入 `patchDocument` 工具，使 Agent Patch 的 smoke 测试无需真实 LLM。

### 2.2 集成运行时层 — `packages/server/src/integration/`

这是与 OpenClaw 外部仓库打交道的“重型”集成层，核心文件 `openclaw-runtime.ts`（741 行）。

| 模块 | 职责 | 状态 |
|---|---|---|
| `openclaw-runtime.ts` | 动态 `import()` 加载外部 OpenClaw 项目；管理 session；提供 `runEmbeddedPiAgent()` 和 `runOpenClawTextPrompt()` | ✅ 已完成 |
| `openclaw-config.ts` | 自动生成 canonical `openclaw.json` 配置（默认 SiliconFlow 模型） | ✅ 已完成 |
| `integration-gateway.ts` | Feature Flag 网关：`ENABLE_OPENCLAW_KERNEL` 决定走真实还是 Fake | ✅ 已完成 |
| `siliconflow-runtime.ts` | SiliconFlow 直连客户端，与 OpenClaw 并行存在 | ✅ 已完成 |

**关键实现细节：**
- **动态加载**：通过 `import()` 在运行时从 `OPENCLAW_PROJECT_PATH` 或默认候选路径（`../reference_projects/openclaw`）加载 OpenClaw 的 `dist/index.js` 和 `dist/extensionAPI.js`。
- **Session 管理**：维护 `sessionId`、`sessionFile`、`sessionKey` 的解析与持久化，支持 ephemeral text session 和 repair session。
- **Embedded 调用**：不再走外部命令链，而是直接调用 `runtime.runEmbeddedPiAgent()`，把 OpenClaw 当库使用。
- **降级容错**：若 OpenClaw 仓库缺失、构建失败或 Node 版本不足（OpenClaw 要求 >= 22.14.0），会抛出详细诊断错误。
- **单例缓存**：`loadedRuntimePromise` 缓存加载结果，避免重复 `import()`。

### 2.3 API 抽象层 — `packages/server/src/routes/agent/`

Agent Chat HTTP 端点完全建立在 `KernelRuntime` 抽象之上。

```
POST /api/agent/chat
  → integration-gateway.getKernelRuntime()
    → [Fake] createFakeOpenClawKernel()
    → [Real] createOpenClawAdapter({ runner: createRealOpenClawAgentRunner() })
  → runtime.run({ message, sessionId, sessionKey, documentId })
  → 收集 KernelEvent[] → 返回最后一条 assistant 文本
```

**状态：** 路由层本身无债务，但 **默认关闭真实内核**（`ENABLE_OPENCLAW_KERNEL=false`）。

### 2.4 Workbench AI 结构化层 — `packages/server/src/services/workbench-application.ts`

Workbench 的 `generateDocument` 是 OpenClaw 在业务层的最大集成点。

**Prompt Runner 选择逻辑：**
1. `WORKBENCH_PROMPT_PROVIDER === "openclaw"` → `runOpenClawTextPrompt`
2. `WORKBENCH_PROMPT_PROVIDER === "siliconflow-direct"` → `runSiliconFlowTextPrompt`
3. `SILICONFLOW_API_KEY` 存在 → `runSiliconFlowTextPrompt`
4. **Fallback** → `runOpenClawTextPrompt`

**实际运行现状：**
- 由于 `.env.example` 默认 `WORKBENCH_PROMPT_PROVIDER="siliconflow-direct"`，且 SiliconFlow API Key 通常会被配置，**Workbench 实际默认不走 OpenClaw**。
- OpenClaw 在这里的角色是“兜底_runner”。

**当走 OpenClaw 时的调用细节：**
- 构建超长中文结构化 prompt（科研文档助手）。
- 强制 lightweight 模式：`disableTools: true`、`thinkLevel: "off"`、`verboseLevel: "off"`。
- 默认 60s 超时（`OPENCLAW_TIMEOUT_MS`）。
- 返回字符串后经过三层 JSON 解析/修复/回退逻辑，最终转为 `doc-schema` 的 `Doc`。

### 2.5 测试验证层 — `scripts/smoke/`

| 脚本 | 测试内容 | 模式 | CI 状态 |
|---|---|---|---|
| `openclaw-kernel.mjs` | 端到端 KernelRuntime 事件流 | Fake / Real 双模 | ❌ 未进 CI |
| `openclaw-text-live.mjs` | `runOpenClawTextPrompt` 真实调用 | 仅 Real | ❌ 未进 CI |
| `kernel-contract.ts` | Fake 与 Real 适配器的事件形状契约 | Fake（模拟 Real） | ✅ CI 已包含 |
| `agent-patch.ts` | Fake Kernel 的文档 patch 操作 | 仅 Fake | ❌ 未进 CI |
| `workbench-live.mjs` | Workbench 全链路（含 AI 结构化） | 仅 Real（需 API Key） | ❌ 未进 CI |
| `workbench.mjs` | Workbench 离线全链路（mock AI） | Mock | ❌ 未进 CI |

**评估：** 契约测试已进 CI 是好事，但 `openclaw-kernel` 和 `workbench-live` 这两个最能验证“真实 OpenClaw 是否活着”的脚本尚未自动化。

---

## 3. 架构设计质量评估

### 3.1 做得好的地方

1. **端口-适配器模式执行到位**  
   `xiaolongxia-kernel` 完全隔离了 OpenClaw 的具体实现，server 只依赖 `KernelRuntime` 和 `KernelEvent`。未来即使换掉 OpenClaw，也只需新增一个 adapter。

2. **Feature Flag 控制清晰**  
   `ENABLE_OPENCLAW_KERNEL` 和 `WORKBENCH_PROMPT_PROVIDER` 两个开关把“真实/假”、“OpenClaw/直连”的矩阵控制得很清楚，便于灰度和回滚。

3. **事件流抽象统一**  
   `KernelEvent` 是跨前后端的标准事件模型，前端 `AgentChat.vue` 可以统一消费，不关心底层是 Fake 还是 Real。

4. **外部仓库轻度耦合**  
   OpenClaw 通过动态 `import()` 加载，不是 npm/workspace 依赖。这避免了把 OpenClaw 的构建图和版本锁拖进黑豆芽。

5. **配置收口完成**  
   根据 `STITCH_STATUS.md`，双配置问题已解决：只认 `.openclaw-runtime/openclaw.json`，密钥走环境变量，`.tmp/openclaw-smoke-state` 已退出主链。

### 3.2 需要警惕的地方

1. **动态加载的脆弱性**  
   `openclaw-runtime.ts` 的 `import()` 路径探测和 Node 版本检查（>= 22.14.0）是运行时炸弹。如果 OpenClaw 重构了导出结构或改变了入口文件位置，这里会静默崩溃。

2. **单例缓存的毒化风险**  
   `loadedRuntimePromise` 一旦 reject，错误会被永久缓存，必须重启进程才能恢复。

3. **Fake 与 Real 的行为漂移**  
   `kernel-contract.ts` 目前只是“形状”契约（stream:phase 序列字符串比对），没有验证事件 payload 的语义等价性。Fake Kernel 返回的 `assistant` 文本是硬编码的，与 Real 的流式 delta 在时序和分片行为上差异很大。

4. **Workbench 的 Prompt Runner 默认非 OpenClaw**  
   从架构目标来看，“OpenClaw 是唯一 AI 内核”是最简融合方案的核心决策。但 Workbench 默认走 SiliconFlow 直连，实际上把 OpenClaw 边缘化了。

---

## 4. 当前配置与开关状态

| 环境变量 | 默认值 | 实际效果 |
|---|---|---|
| `ENABLE_OPENCLAW_KERNEL` | `false` | Agent Chat 走 Fake Kernel |
| `WORKBENCH_PROMPT_PROVIDER` | `"siliconflow-direct"` | Workbench 结构化走 SiliconFlow 直连 |
| `OPENCLAW_PROJECT_PATH` | `"../reference_projects/openclaw"` | 外部 OpenClaw 仓库路径 |
| `OPENCLAW_MODEL` | `"siliconflow/Qwen/Qwen2.5-7B-Instruct"` | 模型选择 |

**结论：如果不手动改 env，整个系统与 OpenClaw 的真实内核是“物理断连”的。**

---

## 5. 已知架构债务澄清

### 5.1 关于开发手册 v2 中的 G1（已消除）

开发手册 v2 描述了一个 Gap：

> `XiaolongxiaKernelRuntime` 内部直接 `new AgentOrchestrator`，**不是真实 OpenClaw 主链**。

**经代码审计，该债务在当前代码库中已不存在。**

实际执行路径是：
```
/api/agent/chat
  → IntegrationGateway
    → createOpenClawAdapter({ runner: createRealOpenClawAgentRunner() })
      → loadOpenClawRuntime() → import('../reference_projects/openclaw')
      → runtime.runEmbeddedPiAgent()
```

代码中没有任何 `AgentOrchestrator` 或 `orchestrator` 的引用。这说明：
- 要么该债务在早期版本中存在，已被重构解决；
- 要么手册描述的是设计阶段的担忧，而实际编码时已经绕开。

**建议：** 更新开发手册 v2，将 G1 标记为“已解决”或降级为“验证中”。

### 5.2 当前真实的债务列表

按影响排序：

| # | 债务 | 影响 | 建议处理 |
|---|---|---|---|
| D1 | `ENABLE_OPENCLAW_KERNEL` 默认 `false` | Agent Chat 不是真 AI | 在稳定环境中设为 `true`，并补全 CI |
| D2 | Workbench 默认走 `siliconflow-direct` | OpenClaw 未被真正验证为生产力 | 增加 `WORKBENCH_PROMPT_PROVIDER=openclaw` 的专项 smoke |
| D3 | `openclaw-kernel.mjs` / `workbench-live.mjs` 未进 CI | 合并可能破坏真实链路 | 在 CI 中增加一个带真实 OpenClaw 的 job（可标记为 `continue-on-error` 或仅在特定分支运行） |
| D4 | `loadedRuntimePromise` 错误缓存 | 加载失败后必须重启进程 | 增加重试或刷新机制 |
| D5 | OpenClaw 要求 Node >= 22.14.0，项目要求 >= 20.0.0 | 运行时版本冲突 | 统一为 Node 22 LTS，或在文档中明确说明 |

---

## 6. 下一步建议

### 短期（本周）
1. **开启真实内核验证**：在本地或 staging 环境设置 `ENABLE_OPENCLAW_KERNEL=true`，跑通 `smoke:openclaw-kernel` 和 `smoke:workbench-live`。
2. **更新开发手册**：将 G1 标记为已解决，把 D1~D5 写入新的 Gap 清单。
3. **修复 `loadedRuntimePromise` 缓存毒化**：加载失败时应允许后续请求重试。

### 中期（本月）
1. **把 `openclaw-kernel` smoke 纳入 CI**：可以作为一个独立 job，不要求通过，但要有可见性。
2. **Workbench 双跑验证**：让 Workbench 同时支持 `openclaw` 和 `siliconflow-direct`，跑相同输入，对比输出质量，决定哪个作为默认。
3. **统一 Node 版本**：项目要求提升到 Node 22 LTS，与 OpenClaw 对齐。

### 长期（下月及以后）
1. **Fake Kernel 的语义对齐**：让 Fake 适配器模拟 Real 的流式 delta 行为，使前端在 Fake 模式下也能验证流式 UI。
2. **KernelEvent 的 `patch` 流类型打通**：当前 Agent Chat 返回的是 `assistant` 文本，真正的 Agent 编辑文档应走 `KernelPatchEvent`，需要验证 OpenClaw 侧的 `patch_document` tool 是否能正确触发并映射。

---

## 7. 附录：关键文件索引

| 文件 | 作用 |
|---|---|
| `packages/xiaolongxia-kernel/src/ports/openclaw-port.ts` | OpenClaw 端口接口 |
| `packages/xiaolongxia-kernel/src/adapters/openclaw-adapter.ts` | 真实适配器 |
| `packages/xiaolongxia-kernel/src/adapters/fake-openclaw-kernel.ts` | Fake 适配器 |
| `packages/xiaolongxia-kernel/src/adapters/event-mapper.ts` | 事件映射器 |
| `packages/server/src/integration/openclaw-runtime.ts` | 动态加载与嵌入式调用 |
| `packages/server/src/integration/openclaw-config.ts` | 配置生成 |
| `packages/server/src/integration/integration-gateway.ts` | Feature Flag 网关 |
| `packages/server/src/routes/agent/index.ts` | Agent Chat HTTP 端点 |
| `packages/server/src/services/workbench-application.ts` | Workbench AI 结构化 |
| `scripts/smoke/openclaw-kernel.mjs` | OpenClaw 内核 smoke |
| `scripts/smoke/kernel-contract.ts` | 事件契约测试 |
| `scripts/smoke/workbench-live.mjs` | Workbench 全链路 live smoke |
| `docs/STITCH_STATUS.md` | 缝合现状（2026-04-25） |
| `docs/SIMPLEST_FUSION_PLAN.md` | 最简融合方案 |
| `docs/wjb/BLACK_BEAN_SPROUTS_REFERENCE_AND_PARALLEL_DEV_GUIDE(1).md` | 开发手册 v2 |
