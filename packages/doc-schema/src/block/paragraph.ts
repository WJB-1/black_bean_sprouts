// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";
import type { InlineNode } from "../inline";

export type ParagraphRole =
  | "normal" | "quote" | "code"
  | "note" | "caption" | "list-item";

export interface ParagraphOverrides {
  align?: "left" | "center" | "right" | "justify";
  indent?: { firstLine?: boolean; left?: number };
  spacing?: { before?: number; after?: number; lineHeight?: number };
}

export interface Paragraph extends BlockBase {
  type: "paragraph";
  attrs: {
    role?: ParagraphRole;
    overrides?: ParagraphOverrides;
  };
  content: InlineNode[];
}
