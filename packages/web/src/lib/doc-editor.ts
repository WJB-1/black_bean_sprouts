// @doc-schema-version: 1.0.0
import type { Abstract, BlockNode, InlineNode, Paragraph, Section } from "@black-bean-sprouts/doc-schema";

export function createSectionNode(title = "New Section", level: 1 | 2 | 3 | 4 | 5 = 1): Section {
  return {
    id: crypto.randomUUID(),
    type: "section",
    attrs: { level, title },
    content: [createParagraphNode("")],
  };
}

export function createParagraphNode(text: string, role: Paragraph["attrs"]["role"] = "normal"): Paragraph {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    attrs: role ? { role } : {},
    content: textToInlineNodes(text),
  };
}

export function createAbstractNode(language: "zh" | "en" = "zh"): Abstract {
  return {
    id: crypto.randomUUID(),
    type: "abstract",
    attrs: { language, keywords: [] },
    content: [createParagraphNode("")],
  };
}

export function getEditableChildren(node: BlockNode): BlockNode[] {
  switch (node.type) {
    case "section":
    case "abstract":
      return node.content;
    default:
      return [];
  }
}

export function textToInlineNodes(text: string): InlineNode[] {
  if (!text.trim()) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .flatMap<InlineNode>((line, index, source) => (
      index === source.length - 1
        ? [{ type: "text", text: line }]
        : [{ type: "text", text: `${line}\n` }]
    ));
}

export function keywordsToText(keywords: readonly string[] | undefined): string {
  return keywords?.join(", ") ?? "";
}

export function textToKeywords(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
