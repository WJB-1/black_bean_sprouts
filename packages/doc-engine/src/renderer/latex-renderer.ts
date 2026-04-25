import { Buffer } from "node:buffer";
import type {
  AbstractBlock,
  BlockNode,
  Doc,
  FigureBlock,
  FormulaBlock,
  HeadingBlock,
  InlineNode,
  ParagraphBlock,
  ReferenceItem,
  ReferenceListBlock,
  SectionBlock,
  TableBlock,
  TableCell,
  TextMark,
} from "@black-bean-sprouts/doc-schema";
import type { StyleProfileDsl } from "../style/style-profile.js";
import { defaultStyleProfile } from "../style/style-profile.js";

export type LatexRenderResult = {
  readonly content: string;
  readonly buffer: Buffer;
  readonly size: number;
};

export class LatexRenderer {
  constructor(private readonly profile: StyleProfileDsl = defaultStyleProfile) {}

  async render(doc: Doc): Promise<LatexRenderResult> {
    const documentFontSize = resolveLatexFontSize(this.profile.fonts.defaultSize);
    const geometry = [
      `top=${this.profile.pageLayout.marginTop}mm`,
      `bottom=${this.profile.pageLayout.marginBottom}mm`,
      `left=${this.profile.pageLayout.marginLeft}mm`,
      `right=${this.profile.pageLayout.marginRight}mm`,
    ].join(", ");

    const lines: string[] = [
      `\\documentclass[${documentFontSize}]{article}`,
      "\\usepackage[utf8]{inputenc}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage{geometry}",
      "\\usepackage{graphicx}",
      "\\usepackage{booktabs}",
      "\\usepackage{longtable}",
      "\\usepackage{array}",
      "\\usepackage{hyperref}",
      "\\usepackage[normalem]{ulem}",
      "\\usepackage{amsmath}",
      "\\usepackage{amssymb}",
      "\\usepackage{setspace}",
      `\\geometry{${geometry}}`,
      `\\setstretch{${Math.max(this.profile.fonts.lineSpacing, 1).toFixed(2)}}`,
      "\\begin{document}",
      `\\title{${escapeLatex(doc.metadata.title)}}`,
    ];

    const authorLine = doc.metadata.authors?.map((author) => escapeLatex(author.name)).join(" \\and ");
    if (authorLine) {
      lines.push(`\\author{${authorLine}}`);
    } else {
      lines.push("\\author{}");
    }
    lines.push("\\date{}");
    lines.push("\\maketitle");
    lines.push("");

    if (doc.metadata.subtitle) {
      lines.push(`\\begin{center}\\textit{${escapeLatex(doc.metadata.subtitle)}}\\end{center}`);
      lines.push("");
    }

    if (doc.metadata.institution) {
      lines.push(`\\begin{center}${escapeLatex(doc.metadata.institution)}\\end{center}`);
      lines.push("");
    }

    if (doc.metadata.keywords?.length) {
      lines.push(
        `\\noindent\\textbf{Keywords:} ${doc.metadata.keywords.map((keyword) => escapeLatex(keyword)).join(", ")}`,
      );
      lines.push("");
    }

    for (const block of doc.children) {
      lines.push(...this.renderBlock(block));
    }

    lines.push("\\end{document}");
    const content = lines.join("\n").replace(/\n{3,}/g, "\n\n");
    const buffer = Buffer.from(content, "utf8");
    return {
      content,
      buffer,
      size: buffer.length,
    };
  }

  private renderBlock(block: BlockNode): string[] {
    switch (block.type) {
      case "paragraph":
        return this.renderParagraph(block);
      case "heading":
        return this.renderHeading(block);
      case "section":
        return this.renderSection(block);
      case "abstract":
        return this.renderAbstract(block);
      case "figure":
        return this.renderFigure(block);
      case "table":
        return this.renderTable(block);
      case "formula":
        return this.renderFormula(block);
      case "reference-list":
        return this.renderReferenceList(block);
      default:
        return [];
    }
  }

  private renderParagraph(block: ParagraphBlock): string[] {
    const text = this.renderInlines(block.children);
    return text ? [text, ""] : [""];
  }

  private renderHeading(block: HeadingBlock): string[] {
    const headingText = this.renderInlines(block.children);
    const command = resolveHeadingCommand(block.level);
    return headingText ? [`${command}{${headingText}}`, ""] : [""];
  }

  private renderSection(block: SectionBlock): string[] {
    const lines = [`\\section{${escapeLatex(block.title)}}`, ""];
    for (const child of block.children) {
      lines.push(...this.renderBlock(child));
    }
    return lines;
  }

  private renderAbstract(block: AbstractBlock): string[] {
    const lines = ["\\begin{abstract}"];
    for (const paragraph of block.children) {
      const rendered = this.renderInlines(paragraph.children);
      if (rendered) {
        lines.push(rendered, "");
      }
    }
    lines.push("\\end{abstract}", "");
    return lines;
  }

  private renderFigure(block: FigureBlock): string[] {
    const figureWidth = block.width && block.width > 0 ? `${Math.min(block.width, 100)}\\linewidth` : "0.8\\linewidth";
    const altText = escapeLatex(block.alt ?? block.src);
    const lines = [
      "\\begin{figure}[h]",
      "\\centering",
      `\\includegraphics[width=${figureWidth}]{${escapeLatexForCommand(block.src)}}`,
    ];
    if (block.caption?.length) {
      lines.push(`\\caption{${this.renderInlines(block.caption)}}`);
    } else if (altText) {
      lines.push(`\\caption{${altText}}`);
    }
    lines.push("\\end{figure}", "");
    return lines;
  }

  private renderTable(block: TableBlock): string[] {
    const headerCells = block.headerRow?.cells ?? [];
    const rowCells = block.rows.map((row) => row.cells);
    const columnCount = Math.max(
      headerCells.length,
      rowCells.reduce((max, row) => Math.max(max, row.length), 0),
      1,
    );
    const columnSpec = Array.from({ length: columnCount }, () => "p{0.22\\linewidth}").join("|");
    const lines = ["\\begin{longtable}{" + columnSpec + "}"];

    if (block.caption?.length) {
      lines.push(`\\caption{${this.renderInlines(block.caption)}}\\\\`);
    }

    if (headerCells.length) {
      lines.push(renderTableRow(headerCells.map((cell) => this.renderTableCell(cell))), "\\hline");
    }

    for (const row of block.rows) {
      lines.push(renderTableRow(row.cells.map((cell) => this.renderTableCell(cell))), "\\hline");
    }

    lines.push("\\end{longtable}", "");
    return lines;
  }

  private renderTableCell(cell: TableCell): string {
    const parts = cell.children
      .map((paragraph) => this.renderInlines(paragraph.children))
      .filter((value) => value.length > 0);
    return parts.join(" \\par ");
  }

  private renderFormula(block: FormulaBlock): string[] {
    const lines = ["\\begin{equation*}", block.latex.trim() || "\\,", "\\end{equation*}"];
    if (block.caption?.length) {
      lines.push(`\\begin{center}\\textit{${this.renderInlines(block.caption)}}\\end{center}`);
    }
    lines.push("");
    return lines;
  }

  private renderReferenceList(block: ReferenceListBlock): string[] {
    const lines = ["\\begin{thebibliography}{99}"];
    for (const item of block.items) {
      lines.push(`\\bibitem{${escapeBibKey(item.key)}} ${this.renderReferenceItem(item)}`);
    }
    lines.push("\\end{thebibliography}", "");
    return lines;
  }

  private renderReferenceItem(item: ReferenceItem): string {
    const parts = [
      item.authors.length ? escapeLatex(item.authors.join(", ")) : undefined,
      `(${item.year ?? "n.d."})`,
      `\\textit{${escapeLatex(item.title)}}`,
      escapeLatex(item.source),
      item.doi ? `\\href{https://doi.org/${escapeLatexForCommand(item.doi)}}{doi:${escapeLatex(item.doi)}}` : undefined,
      item.url ? `\\url{${escapeLatexForCommand(item.url)}}` : undefined,
    ].filter((part): part is string => Boolean(part));
    return parts.join(". ") + ".";
  }

  private renderInlines(inlines: readonly InlineNode[]): string {
    return inlines
      .map((inline) => {
        switch (inline.type) {
          case "text":
            return applyMarks(escapeLatex(inline.text), inline.marks ?? []);
          case "hardBreak":
            return "\\\\";
          case "citation":
            return `[${escapeLatex(inline.text ?? inline.refId)}]`;
          case "xref":
            return escapeLatex(inline.label ?? inline.targetId);
          case "formula-inline":
            return `$${inline.latex.trim() || "\\,"}$`;
          default:
            return "";
        }
      })
      .join("");
  }
}

function resolveHeadingCommand(level: HeadingBlock["level"]): string {
  switch (level) {
    case 1:
      return "\\section";
    case 2:
      return "\\subsection";
    case 3:
      return "\\subsubsection";
    case 4:
      return "\\paragraph";
    case 5:
      return "\\subparagraph";
    case 6:
      return "\\textbf";
    default:
      return "\\section";
  }
}

function renderTableRow(cells: string[]): string {
  return cells.map((cell) => cell || " ").join(" & ") + " \\\\";
}

function applyMarks(text: string, marks: readonly TextMark[]): string {
  return marks.reduce((acc, mark) => {
    switch (mark.type) {
      case "bold":
        return `\\textbf{${acc}}`;
      case "italic":
        return `\\emph{${acc}}`;
      case "underline":
        return `\\underline{${acc}}`;
      case "strikethrough":
        return `\\sout{${acc}}`;
      case "code":
        return `\\texttt{${acc}}`;
      case "superscript":
        return `\\textsuperscript{${acc}}`;
      case "subscript":
        return `$_{\\text{${acc}}}$`;
      default:
        return acc;
    }
  }, text);
}

function escapeBibKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "-") || "ref";
}

function escapeLatex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function escapeLatexForCommand(value: string): string {
  return value.replace(/\\/g, "/").replace(/([{}%#])/g, "\\$1");
}

function resolveLatexFontSize(halfPointSize: number): "10pt" | "11pt" | "12pt" {
  const pointSize = Math.max(halfPointSize / 2, 10);
  if (pointSize <= 10.5) {
    return "10pt";
  }
  if (pointSize <= 11.5) {
    return "11pt";
  }
  return "12pt";
}
