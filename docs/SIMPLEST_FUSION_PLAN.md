# 黑豆芽最简融合方案

> 目标不是“把所有参考项目都缝进来”，而是“最快做出一个真的能用的 AI 文档系统”。

## 一句话方案

最简单、最稳、最少坑的方案是：

- `black_bean_sprouts` 当产品壳
- `OpenClaw` 当唯一 AI 内核
- `doc-schema` 当唯一文档 AST
- `Tiptap / ProseMirror` 只当编辑器底座
- `doc-engine + docx + LatexRenderer` 当导出层
- 其他参考项目一律先降级为“参考资料”，不要继续硬缝

## 为什么不能再按“每个参考项目都库化”推进

因为那条路对当前目标来说，收益太低，成本太高：

- `OpenClaw`、`AFFiNE`、`Outline`、`Docmost`、`BlockSuite`、`AppFlowy` 根本不是同一层东西
- 有的是 AI 内核，有的是整套产品，有的是编辑器框架，有的是后台管理参考
- 强行都改成库，最后只会得到一个边界全乱、升级全炸、没人敢动的怪物

所以现在应该反过来：

- **只保留一条主链**
- 其他仓库只提炼思想，不拉进主运行面

## 现在应该保留什么

## 必须保留

- `reference_projects/openclaw`
  - 作用：AI 内核
  - 结论：必须留，而且是唯一内核

- `packages/doc-schema`
  - 作用：文档唯一真相
  - 结论：不能换，不能让前端状态越权

- `packages/doc-engine` + `docx` + `LatexRenderer`
  - 作用：最终导出
  - 结论：这就是成品出口

- `Tiptap / ProseMirror`
  - 作用：后续富文本编辑底座
  - 结论：只当编辑器框架，不当真相来源

## 只做参考，不做接入

这些仓库现在都不应该进入主链：

- `affine`
- `blocksuite`
- `blocknote`
- `appflowy-editor`
- `outline`
- `docmost`
- `lexical`

它们最多只应该提供：

- 交互参考
- 布局参考
- 权限设计参考
- patch 语义参考

而不是变成运行时依赖。

## 明确后置，不要抢跑

这些东西现在一律后放：

- `bullmq`
- `minio`
- `yjs`
- `hocuspocus`
- `pagedjs`
- `pandoc`

原因很简单：

- 它们都是“把系统做大”的部件
- 不是“把 MVP 做成”的部件

## 最偷懒但能交付的产品形态

如果只追求“最快做出一个满足文档目标的 AI 系统”，那就走这个版本：

### MVP-0：工作台导入整理器

链路：

1. 用户粘贴原始文稿或上传文本
2. OpenClaw 根据提示词做结构化
3. 后端把结果转成 `doc-schema` 的 `Doc`
4. 用户直接导出 `docx`
5. 用户直接导出 `latex`

这个版本甚至可以先不做复杂编辑器，只要：

- AI 内核是真的
- 导出结果是真的
- 文档结构是统一 AST

它就已经是一个成立的最小产品了。

### MVP-1：把结构化结果落成正式文档

在 MVP-0 跑顺以后，再补：

1. 把生成出的 `Doc` 存库
2. 前端编辑器读取这个 `Doc`
3. 所有修改继续走 `DocumentPatchBatch`
4. 保持“AI 生成”和“人工编辑”走同一文档模型

### MVP-2：再考虑生产化

只有前两步稳定后，才考虑：

- BullMQ 异步渲染
- MinIO 文件持久化
- 权限后台
- 协同编辑
- PDF/排版预览

## 最简单的技术边界

为了不再乱，边界就锁死成下面这样：

- AI：只认 `OpenClaw`
- 文档真相：只认 `doc-schema`
- 写入协议：只认 `DocumentPatchBatch`
- 导出：只认 `doc-engine`
- 编辑器：只是 AST 的一个视图，不是数据源

任何参考项目，只要碰到这五条边界，就不能继续往里缝。

## 接下来怎么干最省力

按“止血优先”排，直接做这四步：

## 第一步：统一 OpenClaw 配置

必须先把默认配置和 smoke 配置收成一套。

建议直接定死：

- 正式 state dir：`E:\Coding\校外\black_bean_sprouts\.openclaw-runtime`
- 正式 config：`E:\Coding\校外\black_bean_sprouts\.openclaw-runtime\openclaw.json`
- 正式 workspace：`E:\Coding\校外\black_bean_sprouts`

## 第二步：把工作台变成正式入口

别再先想大编辑器，先把当前工作台做成可演示入口：

- 文本输入
- 文件导入
- AI 结构化
- 预览结构结果
- 导出 DOCX / LaTeX

这一步完成，你就已经有一个可展示、可验证、可交付的 AI 文档工具了。

## 第三步：只接一套编辑器

如果下一步一定要上编辑器，就只接：

- `Tiptap / ProseMirror`

不要同时研究：

- `BlockSuite`
- `BlockNote`
- `Lexical`
- `AppFlowy`

否则会重新回到“项目太大，无从下手”的状态。

## 第四步：其余参考仓库全部降级

处理原则非常简单：

- 要代码就抄思路，不抄整仓
- 要设计就抄边界，不抄产品
- 能晚接就晚接
- 能不接就不接

## 最终推荐决策

如果现在要我拍板，我会这么定：

- **不再推进“把所有 reference_projects 都改成库”**
- **只保留 OpenClaw 作为唯一必须真实接入的外部内核**
- **当前版本先把工作台路线做成**
- **其余参考项目全部改成“查资料时再看”的参考仓**

这条路线最土，但最容易活下来。

## 成功标准

做到下面四条，就算第一阶段成功：

1. 给一份未整理原稿，系统能稳定生成结构化文档
2. 内核是真 OpenClaw，不是假 orchestrator
3. 输出至少有 `docx` 和 `latex`
4. 整个系统不依赖大规模深缝其他参考项目

只要这四条成立，文档要求就基本落地了。
