import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
} from "docx";
import type { Doc, BlockNode, ParagraphBlock, HeadingBlock, FigureBlock, TableBlock as DocTable, TableRow as DocTableRow, FormulaBlock, SectionBlock, AbstractBlock, ReferenceListBlock, InlineNode, ReferenceItem } from "@black-bean-sprouts/doc-schema";
import type { HeadingStyle } from "../style/style-profile.js";
import type { StyleProfileDsl } from "../style/style-profile.js";
import { defaultStyleProfile } from "../style/style-profile.js";

export type RenderResult = { readonly buffer: Buffer; readonly size: number };

export class DocxRenderer {
  constructor(private readonly profile: StyleProfileDsl = defaultStyleProfile) {}

  async render(doc: Doc): Promise<RenderResult> {
    const children: Paragraph[] = [];

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
  renderBlock(block: BlockNode): Paragraph[] | null {
    return this.renderBlockInternal(block);
  }

  private renderBlockInternal(block: BlockNode): Paragraph[] | null {
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

  private renderSection(section: SectionBlock): Paragraph[] {
    const result: Paragraph[] = [];
    result.push(new Paragraph({
      children: [new TextRun({ text: section.title, bold: true, size: 32 })],
      spacing: { before: 400, after: 200 },
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
      spacing: { line: Math.round(this.profile.fonts.defaultSize * this.profile.fonts.lineSpacing) },
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

  private renderAbstract(abstract: AbstractBlock): Paragraph[] {
    const result: Paragraph[] = [];
    result.push(new Paragraph({ children: [new TextRun({ text: "Abstract", bold: true, size: 28 })], spacing: { before: 300, after: 100 } }));
    for (const para of abstract.children) {
      result.push(new Paragraph({ children: this.renderInlines(para.children), spacing: { line: Math.round(this.profile.fonts.defaultSize * this.profile.fonts.lineSpacing) } }));
    }
    return result;
  }

  private renderFigure(figure: FigureBlock): Paragraph[] {
    const result: Paragraph[] = [];
    result.push(new Paragraph({ children: [new TextRun({ text: "[Figure: " + (figure.alt ?? figure.src) + "]", italics: true, size: 20 })], alignment: AlignmentType.CENTER }));
    if (figure.caption) result.push(new Paragraph({ children: this.renderInlines(figure.caption), alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
    return result;
  }

  private renderTable(table: DocTable): Paragraph[] {
    const rows: TableRow[] = [];
    if (table.headerRow) rows.push(this.makeRow(table.headerRow, true));
    for (const row of table.rows) rows.push(this.makeRow(row, false));
    // Tables need special handling - return placeholder for now
    return [new Paragraph({ children: [new TextRun({ text: "[Table with " + table.rows.length + " rows]", italics: true })], alignment: AlignmentType.CENTER })];
  }

  private makeRow(row: DocTableRow, isHeader: boolean): TableRow {
    return new TableRow({
      children: row.cells.map(cell => new TableCell({
        children: cell.children.map(para => new Paragraph({ children: this.renderInlines(para.children) })),
      })),
    });
  }

  private renderFormula(formula: FormulaBlock): Paragraph[] {
    const result: Paragraph[] = [];
    result.push(new Paragraph({ children: [new TextRun({ text: formula.latex, italics: true, size: 24, font: "Cambria Math" })], alignment: AlignmentType.CENTER }));
    if (formula.caption) result.push(new Paragraph({ children: this.renderInlines(formula.caption), alignment: AlignmentType.CENTER }));
    return result;
  }

  private renderReferenceList(list: ReferenceListBlock): Paragraph[] {
    const result: Paragraph[] = [];
    result.push(new Paragraph({ children: [new TextRun({ text: "References", bold: true, size: 28 })], spacing: { before: 400, after: 200 } }));
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

  private renderInlines(inlines: readonly InlineNode[]): TextRun[] {
    return inlines.map(inline => {
      if (inline.type === "text") {
        const marks = inline.marks ?? [];
        return new TextRun({
          text: inline.text, size: this.profile.fonts.defaultSize, font: this.profile.fonts.defaultFamily,
          ...(marks.some(m => m.type === "bold") ? { bold: true } : {}),
          ...(marks.some(m => m.type === "italic") ? { italics: true } : {}),
          ...(marks.some(m => m.type === "underline") ? { underline: {} } : {}),
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
}

function mmToTwip(mm: number): number { return Math.round(mm * 56.7); }
