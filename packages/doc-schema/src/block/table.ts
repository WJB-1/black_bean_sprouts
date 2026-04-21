// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";
import type { InlineNode } from "../inline";

export interface TableCell {
  content: InlineNode[];
  colspan?: number;
  rowspan?: number;
  header?: boolean;
}

export interface TableRow {
  cells: TableCell[];
}

export interface Table extends BlockBase {
  type: "table";
  attrs: {
    caption: string;
    label?: string;
    borderStyle?: "full" | "three-line" | "none";
    colWidths?: number[];
  };
  content: TableRow[];
}
