// @doc-schema-version: 1.0.0

/** 所有 Block 级节点的基础 — 强制稳定 ID */
export interface BlockBase {
  id: string;        // nanoid, 创建时生成, 永不变
  type: string;
}

/** Inline 节点不需要强制 ID (position 定位足够) */
export interface InlineBase {
  type: string;
}
