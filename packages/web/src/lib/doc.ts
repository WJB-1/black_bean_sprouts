import type { Doc, InlineNode } from "@black-bean-sprouts/doc-schema";

export function getDocTitle(doc: Doc | null | undefined): string {
  const title = doc?.attrs.title?.trim();
  return title && title.length > 0 ? title : "未命名文档";
}

export function getDocSubtitle(doc: Doc | null | undefined): string {
  const subtitle = doc?.attrs.subtitle?.trim();
  const institution = doc?.attrs.institution?.trim();
  return [subtitle, institution].filter(Boolean).join(" · ");
}

export function inlineNodesToText(nodes: InlineNode[] | undefined): string {
  if (!nodes || nodes.length === 0) {
    return "";
  }

  return nodes.map((node) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "citation_ref":
        return `[引文 ${node.attrs.refId}]`;
      case "xref":
        return `[跳转 ${node.attrs.targetId}]`;
      case "footnote_ref":
        return `[脚注 ${node.attrs.fnId}]`;
      case "inline_formula":
        return `\\(${node.attrs.latex}\\)`;
      default:
        return "";
    }
  }).join("");
}
