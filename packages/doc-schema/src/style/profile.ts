// @doc-schema-version: 1.0.0
import type { NumberingSchemes } from "./numbering";
import type { FontFamilies } from "./fonts";
import type { SectionStyles } from "./section-style";
import type { ParagraphStyles } from "./paragraph-style";
import type { FigureStyle } from "./figure-style";
import type { TableStyle } from "./table-style";
import type { AbstractStyle } from "./abstract-style";
import type { CoverStyle } from "./cover-style";
import type { CitationStyleConfig } from "./citation-style";

export interface StyleProfile {
  id: string;
  name: string;
  docTypeCode: string;
  version: string;
  extends?: string;
  page: {
    size: "A4" | "B5" | "letter";
    orientation: "portrait" | "landscape";
    margin: { top: string; bottom: string; left: string; right: string };
  };
  fonts: FontFamilies;
  numbering: NumberingSchemes;
  nodes: {
    section: SectionStyles;
    paragraph: ParagraphStyles;
    figure: FigureStyle;
    table: TableStyle;
    abstract: AbstractStyle;
    cover: CoverStyle;
    formula: { numberingFormat: string };
    referenceList: { hangingIndent: string; fontSize: number };
  };
  citation: CitationStyleConfig;
  baseDocxTemplateKey?: string;
  thumbnailKey?: string;
  isActive: boolean;
}
