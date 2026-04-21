import type {
  InlineNode,
  Text,
  CitationRef,
  XRef,
  InlineFormula,
  FootnoteRef,
  Mark,
} from "@black-bean-sprouts/doc-schema";
import { TextRun } from "docx";
import type { RendererContext } from "./types.js";

/** Render inline nodes to docx TextRun array */
export function renderInlineNodes(
  nodes: InlineNode[],
  ctx: RendererContext,
): TextRun[] {
  const runs: TextRun[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        runs.push(...renderText(node));
        break;
      case "citation_ref":
        runs.push(renderCitationRef(node, ctx));
        break;
      case "xref":
        runs.push(renderXRef(node, ctx));
        break;
      case "inline_formula":
        runs.push(renderInlineFormula(node));
        break;
      case "footnote_ref":
        runs.push(renderFootnoteRef(node));
        break;
    }
  }
  return runs;
}

function renderText(node: Text): TextRun[] {
  const marks = node.marks ?? [];
  const options: {
    text: string;
    bold?: boolean;
    italics?: boolean;
    underline?: {};
    strike?: boolean;
    superScript?: boolean;
    subScript?: boolean;
  } = { text: node.text };

  if (marks.some((m: Mark) => m.type === "bold")) {
    options.bold = true;
  }
  if (marks.some((m: Mark) => m.type === "italic")) {
    options.italics = true;
  }
  if (marks.some((m: Mark) => m.type === "underline")) {
    options.underline = {};
  }
  if (marks.some((m: Mark) => m.type === "strikethrough")) {
    options.strike = true;
  }
  if (marks.some((m: Mark) => m.type === "superscript")) {
    options.superScript = true;
  }
  if (marks.some((m: Mark) => m.type === "subscript")) {
    options.subScript = true;
  }

  return [new TextRun(options)];
}

function renderCitationRef(node: CitationRef, ctx: RendererContext): TextRun {
  const formatted = ctx.citation.formatInText(node.attrs.refId);
  const prefix = node.attrs.prefix ?? "";
  const suffix = node.attrs.suffix ?? "";
  return new TextRun({ text: `${prefix}${formatted}${suffix}` });
}

function renderXRef(node: XRef, ctx: RendererContext): TextRun {
  const num = ctx.numbering.getNumber(node.attrs.targetId);
  const display = num?.display ?? "??";
  return new TextRun({ text: display });
}

function renderInlineFormula(node: InlineFormula): TextRun {
  // MVP: render as italic text. Production: convert to OMML
  return new TextRun({ text: node.attrs.latex, italics: true });
}

function renderFootnoteRef(node: FootnoteRef): TextRun {
  // MVP: superscript number. Production: proper footnote
  return new TextRun({ text: `[${node.attrs.fnId}]`, superScript: true });
}
