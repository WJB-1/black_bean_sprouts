// @doc-schema-version: 1.0.0
import type { ParagraphStyle } from "./paragraph-style";

export interface FigureStyle {
  captionPosition: "below" | "above";
  captionStyle: ParagraphStyle;
  defaultWidth?: string;
  spacing?: string;
}
