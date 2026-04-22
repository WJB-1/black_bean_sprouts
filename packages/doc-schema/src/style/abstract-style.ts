// @doc-schema-version: 1.0.0
import type { SectionStyle } from "./section-style.js";
import type { ParagraphStyle } from "./paragraph-style.js";

export interface AbstractStyle {
  titleStyle: SectionStyle;
  bodyStyle: ParagraphStyle;
  keywordsStyle: ParagraphStyle;
  pageBreakAfter?: boolean;
}
