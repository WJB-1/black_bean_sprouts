// @doc-schema-version: 1.0.0

/**
 * 交叉引用 — "如图 3-2 所示" "详见 2.3 节"
 * targetId 指向目标 Block 节点的稳定 id
 * 渲染器自动解析为正确编号并生成超链接
 */
export interface XRef {
  type: "xref";
  attrs: {
    targetId: string;
    kind: "figure" | "table" | "formula" | "section";
    display: "number" | "full" | "page";
  };
}
