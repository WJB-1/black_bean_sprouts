// @doc-schema-version: 1.0.0
import type { ParagraphStyle } from "./paragraph-style";

export interface TableStyle {
  captionPosition: "above" | "below";
  captionStyle: ParagraphStyle;
  defaultBorder: "full" | "three-line" | "none";
  headerBold?: boolean;
}
