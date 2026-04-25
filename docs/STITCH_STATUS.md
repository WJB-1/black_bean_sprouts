# 黑豆芽缝合现状说明

> 更新时间：2026-04-25
> 目标：把“现在到底接成什么样了”一次说清楚，避免继续盲改。

## 一句话结论

现在最接近可用产品的形态，不是“把所有参考项目都改成库并缝到一起”，而是：

- `black_bean_sprouts` 作为产品壳
- `OpenClaw` 作为唯一 AI 内核
- `doc-schema` 作为唯一文档真相
- `doc-engine + docx + LatexRenderer` 作为导出层
- 前端先用一个最小工作台，不继续深缝其他参考项目

## 当前 OpenClaw 真实状态

### 1. OpenClaw 项目路径

当前后端包装器默认会优先去找下面这个仓库：

- `E:\Coding\校外\reference_projects\openclaw`

如果设置了环境变量 `OPENCLAW_PROJECT_PATH`，才会改用别的路径。

### 2. 默认运行时目录

当前 `black_bean_sprouts` 里的默认 OpenClaw 运行时目录是：

- `E:\Coding\校外\black_bean_sprouts\.openclaw-runtime`

默认配置文件是：

- `E:\Coding\校外\black_bean_sprouts\.openclaw-runtime\openclaw.json`

默认工作目录是：

- `E:\Coding\校外\black_bean_sprouts`

### 3. 双配置问题已经开始收口

之前确实有两套：

- 默认配置：`E:\Coding\校外\black_bean_sprouts\.openclaw-runtime\openclaw.json`
- 旧 smoke 配置：`E:\Coding\校外\black_bean_sprouts\.tmp\openclaw-smoke-state\openclaw.json`

现在已经改成：

- **正式配置只认** `E:\Coding\校外\black_bean_sprouts\.openclaw-runtime\openclaw.json`
- 如果这个文件缺字段，后端启动时会自动补成 canonical 版本
- SiliconFlow 鉴权不再写死在 json 里，而是从 `SILICONFLOW_API_KEY` 环境变量读取
- `scripts/smoke/openclaw-kernel.mjs` 也改为直接走正式配置，不再切到 `.tmp\openclaw-smoke-state`

也就是说：

- `.tmp\openclaw-smoke-state` 现在是遗留临时目录
- 它不再是正式运行面的一部分

## 当前已经真实接上的东西

## 1. OpenClaw 已经走“嵌入式库调用”

现在后端不是再去走容易挂住的外部命令链，而是通过 `runEmbeddedPiAgent` 直接把 OpenClaw 当内核调用。

这部分的主入口在：

- `packages/server/src/integration/openclaw-runtime.ts`

它现在负责：

- 定位 OpenClaw 仓库
- 准备 state dir / config path / workspace dir
- 解析模型选择
- 维护稳定的 session id / session file
- 调用 embedded OpenClaw
- 把事件统一成黑豆芽能消费的格式

## 2. 已经有一个最小工作台

现在已经补了一条最省事的产品链：

- 原始文本输入
- 调 OpenClaw 做结构化
- 转成 `doc-schema` 的 `Doc`
- 导出 `docx`
- 导出 `latex`

相关文件：

- 前端页面：`packages/web/src/pages/WorkbenchPage.vue`
- 前端路由：`packages/web/src/router/index.ts`
- 后端路由：`packages/server/src/routes/workbench/index.ts`
- 应用服务：`packages/server/src/services/workbench-application.ts`

这条链就是目前最值得保留的 MVP 主链。

## 3. 已经补了 LaTeX 导出

相关文件：

- `packages/doc-engine/src/renderer/latex-renderer.ts`
- `packages/doc-engine/src/index.ts`

所以现在导出层不是只有 DOCX，已经能出 `.tex`。

## 4. 服务端现在允许“降级启动”

现在即使 Redis / MinIO 这类基础设施没准备好，服务端也不会直接把整套工作台拖死。

也就是说：

- 异步渲染链可以先禁用
- 但工作台仍然可以跑

这对当前阶段是对的，因为你现在最需要的是先把 AI 结构化和导出链跑顺。

## 现在的“魔改程度”

## 1. `black_bean_sprouts` 改动偏重

当前仓库里，已经有可见的集成改动，量级大概是：

- tracked diff：`14 files changed, 269 insertions(+), 90 deletions(-)`
- 另外还有若干新增但未跟踪文件，例如：
  - `packages/server/src/integration/openclaw-runtime.ts`
  - `packages/server/src/services/workbench-application.ts`
  - `packages/web/src/pages/WorkbenchPage.vue`
  - `packages/doc-engine/src/renderer/latex-renderer.ts`

换句话说：

- **重改的是黑豆芽产品壳**
- 不是把参考项目整仓硬搬进来

## 2. `reference_projects/openclaw` 改动偏轻

当前 OpenClaw 参考仓库的量级大概是：

- tracked diff：`3 files changed, 53 insertions(+), 1 deletion(-)`

主要是一些嵌入式运行和模型配置相关的小补丁，不是大规模 fork。

结论：

- **OpenClaw 目前属于轻度补丁**
- **黑豆芽这边才是主要魔改现场**

## 哪些是“真接入”，哪些还是“临时态”

## 真接入

下面这些可以视为现在已经成立的真实接入：

- OpenClaw 作为嵌入式 AI 内核被黑豆芽后端调用
- 工作台可以把原始文本转成结构化文档
- 工作台可以导出 DOCX
- 工作台可以导出 LaTeX
- 缺 Redis / MinIO 时，工作台主链还能活

## 临时态 / 测试态

下面这些还不能算真正收口：

- `.tmp/openclaw-smoke-state` 里的旧配置和调试脚本仍可能留在磁盘上，但已经退出主链
- 如果要继续清理，优先删遗留 `.tmp/openclaw-smoke-state`
- 现在工作台更像“导入整理器”，还不是完整 patch-first 编辑器
- BullMQ / MinIO / Yjs / Hocuspocus / PagedJS / Pandoc 都还不该进入当前 MVP 主链

## 当前最值得跑的入口

如果你现在只想最快验证“这个东西是不是活的”，建议只盯下面这条链：

1. 在 `black_bean_sprouts` 根目录执行 `pnpm dev`
2. 打开前端工作台页面 `/workbench`
3. 粘贴一份没整理过的文稿
4. 让 OpenClaw 做结构化
5. 导出 `.docx` 和 `.tex`

配套 smoke 命令：

- `pnpm run smoke:openclaw-kernel`

这条链比“先把所有参考项目库化”现实得多，也更符合你现在要的结果。

## 下一步唯一必须继续盯的工程债

这一条已经开始做了，但还要继续盯：

- **继续保持 OpenClaw 只认一个正式配置入口**

后续原则只有两个：

1. server / workbench / smoke 都只认 `.openclaw-runtime/openclaw.json`
2. 所有密钥都走环境变量，不再回到临时 json 明文
