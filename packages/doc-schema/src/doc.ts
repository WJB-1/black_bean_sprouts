// @doc-schema-version: 1.0.0
import type { DocMeta } from "./meta.js";
import type { ReferenceItem } from "./resource/reference.js";
import type { AssetRef } from "./resource/asset-ref.js";
import type { SchemaVersion } from "./version.js";
import type { BlockNode } from "./block/index.js";
import type { InlineNode } from "./inline/index.js";

/**
 * 顶层文档节点
 * references / assets / footnotes 是文档级资源池,
 * 不在 content 树里 — Agent 添加引用直接 put, 不用遍历 AST
 */
export interface Doc {
  type: "doc";
  schemaVersion: SchemaVersion;
  attrs: DocMeta;
  content: BlockNode[];

  // ── 文档级资源池 ──
  references: Record<string, ReferenceItem>;   // refId → item
  assets: Record<string, AssetRef>;            // assetId → 存储引用
  footnotes: Record<string, InlineNode[]>;     // fnId → 内容
  glossary?: Record<string, string>;           // 术语表 (预留)
}
