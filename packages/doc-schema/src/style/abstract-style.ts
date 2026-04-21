// @doc-schema-version: 1.0.0
import type { SectionStyle } from "./section-style";
import type { ParagraphStyle } from "./paragraph-style";

export interface AbstractStyle {
  titleStyle: SectionStyle;
  bodyStyle: ParagraphStyle;
  keywordsStyle: ParagraphStyle;
  pageBreakAfter?: boolean;
}
