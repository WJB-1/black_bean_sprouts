// Shared types for document rendering

export interface InlineNode {
  type: string;
  text?: string;
  [k: string]: unknown;
}

export interface BaseNode {
  id: string;
  type: string;
  attrs?: Record<string, unknown>;
  content?: unknown;
  [k: string]: unknown;
}

export interface ParagraphNode extends BaseNode {
  type: "paragraph";
  content?: InlineNode[];
}

export interface ChildNode {
  id: string;
  type: string;
  attrs?: Record<string, unknown>;
  content?: ChildNode[];
  [k: string]: unknown;
}

export interface SectionAttrs {
  level?: number;
  title?: string;
  [k: string]: unknown;
}

export interface SectionNode extends BaseNode {
  type: "section";
  attrs?: SectionAttrs;
  content?: ChildNode[];
}

export interface Asset {
  assetId?: string;
  [k: string]: unknown;
}

export interface FigureAttrs {
  caption?: string;
  asset?: Asset;
  [k: string]: unknown;
}

export interface FigureNode extends BaseNode {
  type: "figure";
  attrs?: FigureAttrs;
}

export interface CellContent {
  text?: string;
  [k: string]: unknown;
}

export interface Cell {
  content?: CellContent[];
  header?: boolean;
  [k: string]: unknown;
}

export interface Row {
  cells: Cell[];
  [k: string]: unknown;
}

export interface TableAttrs {
  caption?: string;
  [k: string]: unknown;
}

export interface TableNode extends BaseNode {
  type: "table";
  attrs?: TableAttrs;
  content?: Row[];
}

export interface FormulaAttrs {
  latex?: string;
  [k: string]: unknown;
}

export interface FormulaNode extends BaseNode {
  type: "formula";
  attrs?: FormulaAttrs;
}

export interface ParagraphContent {
  content?: InlineNode[];
  [k: string]: unknown;
}

export interface AbstractAttrs {
  language?: string;
  keywords?: string[];
  [k: string]: unknown;
}

export interface AbstractNode extends BaseNode {
  type: "abstract";
  attrs?: AbstractAttrs;
  content?: ParagraphContent[];
}

export type BlockNode = SectionNode | ParagraphNode | FigureNode | TableNode | FormulaNode | AbstractNode;

export function isSectionNode(node: BlockNode): node is SectionNode {
  return node.type === "section";
}

export function isParagraphNode(node: BlockNode): node is ParagraphNode {
  return node.type === "paragraph";
}

export function isFigureNode(node: BlockNode): node is FigureNode {
  return node.type === "figure";
}

export function isTableNode(node: BlockNode): node is TableNode {
  return node.type === "table";
}

export function isFormulaNode(node: BlockNode): node is FormulaNode {
  return node.type === "formula";
}

export function isAbstractNode(node: BlockNode): node is AbstractNode {
  return node.type === "abstract";
}
