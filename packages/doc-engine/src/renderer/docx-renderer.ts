import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, LineRuleType,
  Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  type FileChild,
} from "docx";
import type { Doc, BlockNode, ParagraphBlock, HeadingBlock, FigureBlock, TableBlock as DocTable, TableRow as DocTableRow, FormulaBlock, SectionBlock, AbstractBlock, ReferenceListBlock, InlineNode, ReferenceItem } from "@black-bean-sprouts/doc-schema";
import type { HeadingStyle } from "../style/style-profile.js";
import type { StyleProfileDsl } from "../style/style-profile.js";
import { defaultStyleProfile } from "../style/style-profile.js";

export type RenderResult = { readonly buffer: Buffer; readonly size: number };

export class DocxRenderer {
  constructor(private readonly profile: StyleProfileDsl = defaultStyleProfile) {}

  async render(doc: Doc): Promise<RenderResult> {
    const children: FileChild[] = [];

    // Title
    children.push(new Paragraph({
      children: [new TextRun({ text: doc.metadata.title, bold: true, size: 36, font: this.profile.fonts.headingFamily })],
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
    }));

    // Subtitle
    if (doc.metadata.subtitle) {
      children.push(new Paragraph({
        children: [new TextRun({ text: doc.metadata.subtitle, italics: true, size: 28 })],
        alignment: AlignmentType.CENTER, spacing: { after: 200 },
      }));
    }

    // Authors
    if (doc.metadata.authors && doc.metadata.authors.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: doc.metadata.authors.map(a => a.name).join(", "), size: 24 })],
        alignment: AlignmentType.CENTER, spacing: { after: 100 },
      }));
    }

    // Keywords
    if (doc.metadata.keywords && doc.metadata.keywords.length > 0) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Keywords: ", bold: true, size: this.profile.fonts.defaultSize }),
          new TextRun({ text: doc.metadata.keywords.join("; "), size: this.profile.fonts.defaultSize }),
        ],
        spacing: { after: 300 },
      }));
    }

    // Blocks
    for (const block of doc.children) {
      const rendered = this.renderBlock(block);
      if (rendered) children.push(...rendered);
    }

    const document = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: mmToTwip(this.profile.pageLayout.width), height: mmToTwip(this.profile.pageLayout.height) },
            margin: {
              top: mmToTwip(this.profile.pageLayout.marginTop),
              bottom: mmToTwip(this.profile.pageLayout.marginBottom),
              left: mmToTwip(this.profile.pageLayout.marginLeft),
              right: mmToTwip(this.profile.pageLayout.marginRight),
            },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(document);
    return { buffer, size: buffer.length };
  }

  /**
   * Public entry point for incremental rendering of a single block.
   * Returns null if the block type is not recognised.
   */
  renderBlock(block: BlockNode): FileChild[] | null {
    return this.renderBlockInternal(block);
  }

  private renderBlockInternal(block: BlockNode): FileChild[] | null {
    switch (block.type) {
      case "paragraph": return [this.renderParagraph(block)];
      case "heading": return [this.renderHeading(block)];
      case "section": return this.renderSection(block);
      case "abstract": return this.renderAbstract(block);
      case "figure": return this.renderFigure(block);
      case "table": return this.renderTable(block);
      case "formula": return this.renderFormula(block);
      case "reference-list": return this.renderReferenceList(block);
      default: return null;
    }
  }

  private renderSection(section: SectionBlock): FileChild[] {
    const result: FileChild[] = [];
    const style = this.getHeadingStyle(1);
    result.push(new Paragraph({
      children: [
        new TextRun({
          text: section.title,
          bold: style.bold,
          size: style.size,
          font: this.profile.fonts.headingFamily,
          ...(style.color ? { color: style.color } : {}),
        }),
      ],
      spacing: { before: style.spacingBefore, after: style.spacingAfter },
    }));
    for (const child of section.children) {
      const r = this.renderBlock(child);
      if (r) result.push(...r);
    }
    return result;
  }

  private renderParagraph(para: ParagraphBlock): Paragraph {
    return new Paragraph({
      children: this.renderInlines(para.children),
      spacing: {
        line: getLineSpacingTwip(this.profile.fonts.defaultSize, this.profile.fonts.lineSpacing),
        lineRule: LineRuleType.AUTO,
        after: 120,
      },
    });
  }

  private renderHeading(heading: HeadingBlock): Paragraph {
    const style = this.getHeadingStyle(heading.level);
    const text = heading.children.filter(c => c.type === "text").map(c => (c as {type:"text";text:string}).text).join("");
    return new Paragraph({
      children: [new TextRun({ text, bold: style.bold, size: style.size, font: this.profile.fonts.headingFamily, ...(style.color ? { color: style.color } : {}) })],
      heading: this.mapHeadingLevel(heading.level),
      spacing: { before: style.spacingBefore, after: style.spacingAfter },
    });
  }

  private renderAbstract(abstract: AbstractBlock): FileChild[] {
    const result: FileChild[] = [];
    const style = this.getHeadingStyle(2);
    result.push(new Paragraph({
      children: [
        new TextRun({
          text: "Abstract",
          bold: style.bold,
          size: style.size,
          font: this.profile.fonts.headingFamily,
          ...(style.color ? { color: style.color } : {}),
        }),
      ],
      spacing: { before: style.spacingBefore, after: style.spacingAfter },
    }));
    for (const para of abstract.children) {
      result.push(new Paragraph({
        children: this.renderInlines(para.children),
        spacing: {
          line: getLineSpacingTwip(this.profile.fonts.defaultSize, this.profile.fonts.lineSpacing),
          lineRule: LineRuleType.AUTO,
          after: 120,
        },
      }));
    }
    return result;
  }

  private renderFigure(figure: FigureBlock): FileChild[] {
    const result: FileChild[] = [];
    result.push(new Paragraph({
      children: [
        new TextRun({
          text: "[Figure] " + (figure.alt ?? figure.src),
          italics: true,
          size: this.profile.figureCaption.size,
        }),
      ],
      alignment: this.resolveAlignment(this.profile.figureCaption.alignment),
    }));
    if (figure.caption) {
      result.push(this.renderCaption(figure.caption, this.profile.figureCaption));
    }
    return result;
  }

  private renderTable(table: DocTable): FileChild[] {
    const result: FileChild[] = [];
    const columnCount = Math.max(
      table.headerRow?.cells.length ?? 0,
      table.rows.reduce((max, row) => Math.max(max, row.cells.length), 0),
      1,
    );
    const rows: TableRow[] = [];
    if (table.caption?.length) {
      result.push(this.renderCaption(table.caption, this.profile.tableCaption));
    }
    if (table.headerRow) rows.push(this.makeRow(table.headerRow, true, columnCount));
    for (const row of table.rows) rows.push(this.makeRow(row, false, columnCount));
    result.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
    }));
    result.push(new Paragraph({ spacing: { after: 180 } }));
    return result;
  }

  private makeRow(row: DocTableRow, isHeader: boolean, columnCount: number): TableRow {
    const paddedCells = [...row.cells];
    while (paddedCells.length < columnCount) {
      paddedCells.push({
        id: `padding-${paddedCells.length}`,
        children: [{ type: "paragraph", id: `padding-paragraph-${paddedCells.length}`, children: [] }],
      });
    }
    return new TableRow({
      tableHeader: isHeader,
      children: paddedCells.map((cell) => new TableCell({
        width: { size: Math.floor(100 / columnCount), type: WidthType.PERCENTAGE },
        children: cell.children.map((para) => new Paragraph({
          children: this.renderInlines(para.children, isHeader ? { bold: true } : undefined),
        })),
      })),
    });
  }

  private renderFormula(formula: FormulaBlock): FileChild[] {
    const result: FileChild[] = [];
    result.push(new Paragraph({ children: [new TextRun({ text: formula.latex, italics: true, size: 24, font: "Cambria Math" })], alignment: AlignmentType.CENTER }));
    if (formula.caption) result.push(this.renderCaption(formula.caption, this.profile.figureCaption));
    return result;
  }

  private renderReferenceList(list: ReferenceListBlock): FileChild[] {
    const result: FileChild[] = [];
    const style = this.getHeadingStyle(2);
    result.push(new Paragraph({
      children: [
        new TextRun({
          text: "References",
          bold: style.bold,
          size: style.size,
          font: this.profile.fonts.headingFamily,
          ...(style.color ? { color: style.color } : {}),
        }),
      ],
      spacing: { before: style.spacingBefore, after: style.spacingAfter },
    }));
    for (const item of list.items) {
      const parts: TextRun[] = [
        new TextRun({ text: item.authors.join(", "), size: this.profile.fonts.defaultSize }),
        new TextRun({ text: " (" + (item.year ?? "n.d.") + "). ", size: this.profile.fonts.defaultSize }),
        new TextRun({ text: item.title, italics: true, size: this.profile.fonts.defaultSize }),
        new TextRun({ text: ". " + item.source + ".", size: this.profile.fonts.defaultSize }),
      ];
      if (item.doi) parts.push(new TextRun({ text: " https://doi.org/" + item.doi, size: this.profile.fonts.defaultSize, color: "0563C1" }));
      result.push(new Paragraph({ children: parts, spacing: { after: 100 } }));
    }
    return result;
  }

  private renderInlines(
    inlines: readonly InlineNode[],
    overrides: {
      readonly bold?: boolean;
      readonly italics?: boolean;
      readonly size?: number;
      readonly font?: string;
      readonly color?: string;
    } = {},
  ): TextRun[] {
    return inlines.map(inline => {
      if (inline.type === "text") {
        const marks = inline.marks ?? [];
        return new TextRun({
          text: inline.text,
          size: overrides.size ?? this.profile.fonts.defaultSize,
          font: overrides.font ?? this.profile.fonts.defaultFamily,
          ...(marks.some(m => m.type === "bold") || overrides.bold ? { bold: true } : {}),
          ...(marks.some(m => m.type === "italic") || overrides.italics ? { italics: true } : {}),
          ...(marks.some(m => m.type === "underline") ? { underline: {} } : {}),
          ...(overrides.color ? { color: overrides.color } : {}),
        });
      }
      if (inline.type === "hardBreak") return new TextRun({ text: "\n", break: 1 });
      if (inline.type === "citation") return new TextRun({ text: "[" + (inline.text ?? inline.refId) + "]", superScript: true, size: this.profile.fonts.defaultSize });
      if (inline.type === "formula-inline") return new TextRun({ text: inline.latex, italics: true, font: "Cambria Math" });
      return new TextRun({ text: "" });
    });
  }

  private getHeadingStyle(level: number): HeadingStyle {
    const h = this.profile.headings;
    if (level <= 3) return [h.h1, h.h2, h.h3][level - 1]!;
    return h.h4 ?? h.h5 ?? h.h6 ?? h.h3;
  }

  private mapHeadingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
    const map: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
    };
    return map[level] ?? HeadingLevel.HEADING_1;
  }

  private renderCaption(
    caption: readonly InlineNode[],
    style: StyleProfileDsl["figureCaption"],
  ): Paragraph {
    return new Paragraph({
      children: this.renderInlines(caption, {
        italics: style.italic,
        size: style.size,
      }),
      alignment: this.resolveAlignment(style.alignment),
      spacing: { after: 180 },
    });
  }

  private resolveAlignment(
    alignment: "center" | "left" | "right",
  ): (typeof AlignmentType)[keyof typeof AlignmentType] {
    switch (alignment) {
      case "left":
        return AlignmentType.LEFT;
      case "right":
        return AlignmentType.RIGHT;
      default:
        return AlignmentType.CENTER;
    }
  }
}

function mmToTwip(mm: number): number { return Math.round(mm * 56.7); }
function getLineSpacingTwip(halfPointSize: number, multiplier: number): number {
  return Math.round(halfPointSize * 10 * multiplier);
}
