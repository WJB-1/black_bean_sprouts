// @doc-schema-version: 1.0.0

/**
 * 脚注引用 — 内容在 doc.footnotes[fnId] 里, 不内嵌
 * 避免文本遍历时特殊处理脚注分支、递归问题、跨页断开
 */
export interface FootnoteRef {
  type: "footnote_ref";
  attrs: { fnId: string };
}
