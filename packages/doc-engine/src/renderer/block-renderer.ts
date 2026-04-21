import type {
  BlockNode,
  Section,
  Paragraph as DocParagraph,
  Figure,
  Table as DocTable,
  Formula,
  Abstract,
  PageBreak,
  Cover,
  ToCPlaceholder,
  Acknowledgements,
  Declaration,
  Appendix,
  ReferenceListPlaceholder,
} from "@black-bean-sprouts/doc-schema";
import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  PageBreak as DocxPageBreak,
  BorderStyle,
  WidthType,
} from "docx";
import type { RendererContext } from "./types.js";
import { renderInlineNodes } from "./inline-renderer.js";

type DocxElement = Paragraph | Table;

/** Render a block node to docx elements */
export function renderBlock(node: BlockNode, ctx: RendererContext): DocxElement[] {
  switch (node.type) {
    case "section":
      return renderSection(node, ctx);
    case "paragraph":
      return [renderParagraph(node, ctx)];
    case "figure":
      return renderFigure(node, ctx);
    case "table":
      return renderTable(node, ctx);
    case "formula":
      return [renderFormula(node, ctx)];
    case "abstract":
      return renderAbstract(node, ctx);
    case "page_break":
      return [new Paragraph({ children: [new DocxPageBreak()] })];
    case "cover":
      return renderCover(node, ctx);
    case "toc_placeholder":
      return renderToC(node, ctx);
    case "acknowledgements":
      return renderAcknowledgements(node, ctx);
    case "declaration":
      return renderDeclaration(node, ctx);
    case "appendix":
      return renderAppendix(node, ctx);
    case "reference_list_placeholder":
      return renderRefList(node, ctx);
  }
}

function renderSection(section: Section, ctx: RendererContext): DocxElement[] {
  const elements: DocxElement[] = [];
  const num = ctx.numbering.getNumber(section.id);
  const title = num ? `${num.display} ${section.attrs.title}` : section.attrs.title;

  const headingMap: Record<number, string> = {
    1: "Heading1",
    2: "Heading2",
    3: "Heading3",
    4: "Heading4",
    5: "Heading5",
  };
  const headingStyle = headingMap[section.attrs.level] ?? "Heading1";

  elements.push(new Paragraph({
    text: title,
    style: headingStyle,
  }));

  for (const child of section.content) {
    elements.push(...renderBlock(child, ctx));
  }
  return elements;
}

function renderParagraph(node: DocParagraph, ctx: RendererContext): Paragraph {
  const runs = renderInlineNodes(node.content, ctx);
  const role = node.attrs.role ?? "normal";

  const overrides = node.attrs.overrides;
  const align = overrides?.align ?? (role === "caption" ? "center" : "justify");

  const options: {
    children: TextRun[];
    alignment: "left" | "center" | "right" | "both";
    spacing?: { before: number; after: number; line?: number };
  } = {
    children: runs,
    alignment: align as "left" | "center" | "right" | "both",
  };

  if (overrides?.spacing) {
    options.spacing = {
      before: overrides.spacing.before ?? 0,
      after: overrides.spacing.after ?? 0,
    };
    if (overrides.spacing.lineHeight) {
      options.spacing.line = overrides.spacing.lineHeight * 240;
    }
  }

  return new Paragraph(options);
}

function renderFigure(figure: Figure, ctx: RendererContext): DocxElement[] {
  const elements: DocxElement[] = [];
  const num = ctx.numbering.getNumber(figure.id);
  const captionText = num ? `${num.display} ${figure.attrs.caption}` : figure.attrs.caption;

  // Placeholder for image (actual image loading is async, handled in DocxRenderer)
  elements.push(new Paragraph({
    children: [new TextRun({ text: `[图片: ${figure.attrs.asset?.assetId ?? "subfigures"}]` })],
    alignment: "center" as const,
  }));

  elements.push(new Paragraph({
    children: [new TextRun({ text: captionText, size: 20 })],
    alignment: "center" as const,
  }));

  return elements;
}

function renderTable(table: DocTable, ctx: RendererContext): DocxElement[] {
  const elements: DocxElement[] = [];
  const num = ctx.numbering.getNumber(table.id);
  const captionText = num ? `${num.display} ${table.attrs.caption}` : table.attrs.caption;

  elements.push(new Paragraph({
    children: [new TextRun({ text: captionText, size: 20 })],
    alignment: "center" as const,
  }));

  const rows = table.content.map((row) =>
    new TableRow({
      children: row.cells.map((cell) => {
        const cellOptions: {
          children: Paragraph[];
          columnSpan?: number;
          rowSpan?: number;
        } = {
          children: [new Paragraph({ children: renderInlineNodes(cell.content, ctx) })],
        };
        if (cell.colspan !== undefined) {
          cellOptions.columnSpan = cell.colspan;
        }
        if (cell.rowspan !== undefined) {
          cellOptions.rowSpan = cell.rowspan;
        }
        return new TableCell(cellOptions);
      }),
    })
  );

  const borderStyle = table.attrs.borderStyle ?? "three-line";

  const tableOptions: {
    rows: TableRow[];
    width?: { size: number; type: typeof WidthType.PERCENTAGE };
    borders?: {
      top: { style: typeof BorderStyle.SINGLE | typeof BorderStyle.NONE; size?: number };
      bottom: { style: typeof BorderStyle.SINGLE | typeof BorderStyle.NONE; size?: number };
      left: { style: typeof BorderStyle.NONE };
      right: { style: typeof BorderStyle.NONE };
      insideHorizontal: { style: typeof BorderStyle.NONE };
      insideVertical: { style: typeof BorderStyle.NONE };
    };
  } = { rows };

  if (borderStyle === "three-line") {
    tableOptions.borders = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    };
  } else if (borderStyle === "none") {
    tableOptions.borders = {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    };
  }

  if (table.attrs.colWidths) {
    tableOptions.width = { size: 100, type: WidthType.PERCENTAGE };
  }

  elements.push(new Table(tableOptions));

  return elements;
}

function renderFormula(formula: Formula, ctx: RendererContext): Paragraph {
  const num = ctx.numbering.getNumber(formula.id);
  const label = num ? `(${num.plainNumber})` : "";
  // MVP: render as monospace text. Production: convert LaTeX to OMML
  return new Paragraph({
    children: [
      new TextRun({ text: formula.attrs.latex, font: "Cambria Math" }),
      new TextRun({ text: `    ${label}` }),
    ],
    alignment: "center" as const,
  });
}

function renderAbstract(abstract: Abstract, ctx: RendererContext): DocxElement[] {
  const elements: DocxElement[] = [];
  const langLabel = abstract.attrs.language === "zh" ? "摘要" : "Abstract";

  elements.push(new Paragraph({
    children: [new TextRun({ text: langLabel, bold: true })],
    alignment: "center" as const,
  }));

  for (const para of abstract.content) {
    elements.push(new Paragraph({
      children: renderInlineNodes(para.content, ctx),
    }));
  }

  const kw = abstract.attrs.keywords.join("; ");
  elements.push(new Paragraph({
    children: [new TextRun({ text: `关键词: ${kw}` })],
  }));

  return elements;
}

function renderCover(_cover: Cover, _ctx: RendererContext): DocxElement[] {
  // MVP: placeholder
  return [new Paragraph({ children: [new TextRun({ text: "[封面]", bold: true })] })];
}

function renderToC(_toc: ToCPlaceholder, _ctx: RendererContext): DocxElement[] {
  // MVP: placeholder
  return [new Paragraph({ children: [new TextRun({ text: "[目录]", bold: true })] })];
}

function renderAcknowledgements(_ack: Acknowledgements, _ctx: RendererContext): DocxElement[] {
  // MVP: placeholder
  return [new Paragraph({ children: [new TextRun({ text: "[致谢]", bold: true })] })];
}

function renderDeclaration(_decl: Declaration, _ctx: RendererContext): DocxElement[] {
  // MVP: placeholder
  return [new Paragraph({ children: [new TextRun({ text: "[声明]", bold: true })] })];
}

function renderAppendix(app: Appendix, ctx: RendererContext): DocxElement[] {
  const num = ctx.numbering.getNumber(app.id);
  const title = num ? num.display : "附录";
  const elements: DocxElement[] = [];

  elements.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true })],
    style: "Heading1",
  }));

  for (const child of app.content) {
    elements.push(...renderBlock(child, ctx));
  }

  return elements;
}

function renderRefList(_ref: ReferenceListPlaceholder, _ctx: RendererContext): DocxElement[] {
  // MVP: placeholder
  return [new Paragraph({ children: [new TextRun({ text: "[参考文献]", bold: true })] })];
}
