// @doc-schema-version: 1.0.0

/**
 * 行内引用 — 渲染器按 StyleProfile 的 CSL 规则格式化
 * 连续多个 citation_ref 由渲染器合并为 "[1-3]"
 * prefix/suffix 支持 "见 [12, pp.3-5]" 这种带上下文的引用
 */
export interface CitationRef {
  type: "citation_ref";
  attrs: {
    refId: string;
    prefix?: string;
    suffix?: string;
  };
}
