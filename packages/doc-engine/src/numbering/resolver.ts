import type { BlockNode, Section, Figure, Table, Formula, Appendix } from "@black-bean-sprouts/doc-schema";
import type { NodeNumber, NumberingCounters } from "./types.js";

export class NumberingResolver {
  private numbers = new Map<string, NodeNumber>();
  private counters: NumberingCounters;
  private currentChapter = 0;

  constructor() {
    this.counters = {
      section: [0, 0, 0, 0, 0],
      figure: 0,
      table: 0,
      formula: 0,
      appendix: 0,
      reference: 0,
    };
  }

  /** Walk AST and assign numbers. Returns nodeId → NodeNumber map */
  resolve(nodes: BlockNode[]): Map<string, NodeNumber> {
    this.walk(nodes);
    return this.numbers;
  }

  /** Get the resolved number for a node, or undefined */
  getNumber(nodeId: string): NodeNumber | undefined {
    return this.numbers.get(nodeId);
  }

  private walk(nodes: BlockNode[]): void {
    for (const node of nodes) {
      if (node.type === "section") {
        this.visitSection(node as Section);
      } else if (node.type === "figure") {
        this.visitFigure(node as Figure);
      } else if (node.type === "table") {
        this.visitTable(node as Table);
      } else if (node.type === "formula") {
        this.visitFormula(node as Formula);
      } else if (node.type === "appendix") {
        this.visitAppendix(node as Appendix);
      } else if ("content" in node && Array.isArray((node as { content?: unknown }).content)) {
        this.walk((node as { content: BlockNode[] }).content);
      }
    }
  }

  private visitSection(section: Section): void {
    const level = section.attrs.level;
    const idx = level - 1;
    const currentVal = this.counters.section[idx] ?? 0;
    this.counters.section[idx] = currentVal + 1;

    // Reset deeper levels
    for (let i = level; i < 5; i++) {
      this.counters.section[i] = 0;
    }

    // Track chapter for figure/table/formula numbering
    if (level === 1) {
      const chapterVal = this.counters.section[0];
      this.currentChapter = chapterVal ?? 0;
      this.counters.figure = 0;
      this.counters.table = 0;
      this.counters.formula = 0;
    }

    const nums = this.counters.section.slice(0, level);
    const plainNumber = nums.join(".");
    const display = plainNumber;

    this.numbers.set(section.id, {
      nodeId: section.id,
      display,
      plainNumber,
    });

    this.walk(section.content);
  }

  private visitFigure(figure: Figure): void {
    this.counters.figure++;
    const plainNumber = `${this.currentChapter}-${this.counters.figure}`;
    this.numbers.set(figure.id, {
      nodeId: figure.id,
      display: `图 ${plainNumber}`,
      plainNumber,
    });
  }

  private visitTable(table: Table): void {
    this.counters.table++;
    const plainNumber = `${this.currentChapter}-${this.counters.table}`;
    this.numbers.set(table.id, {
      nodeId: table.id,
      display: `表 ${plainNumber}`,
      plainNumber,
    });
  }

  private visitFormula(formula: Formula): void {
    this.counters.formula++;
    const plainNumber = `${this.currentChapter}.${this.counters.formula}`;
    this.numbers.set(formula.id, {
      nodeId: formula.id,
      display: `(${plainNumber})`,
      plainNumber,
    });
  }

  private visitAppendix(appendix: Appendix): void {
    this.counters.appendix++;
    const letter = String.fromCharCode(64 + this.counters.appendix);
    this.numbers.set(appendix.id, {
      nodeId: appendix.id,
      display: `附录 ${letter}`,
      plainNumber: letter,
    });
    this.walk(appendix.content);
  }
}
