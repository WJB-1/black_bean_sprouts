// @doc-schema-version: 1.0.0
import type { ParagraphRole } from "../block/paragraph.js";

export interface ParagraphStyle {
  font?: string;
  size?: number;
  lineHeight?: number;
  firstLineIndent?: string;
  align?: "justify" | "left" | "center";
  spaceBefore?: string;
  spaceAfter?: string;
}

export type ParagraphStyles = Record<ParagraphRole, ParagraphStyle> & {
  normal: ParagraphStyle;
};
