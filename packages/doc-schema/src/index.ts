// @doc-schema-version: 1.0.0

// Version
export { SCHEMA_VERSION } from "./version";
export type { SchemaVersion } from "./version";

// Base
export type { BlockBase, InlineBase } from "./base";

// Doc
export type { Doc } from "./doc";

// Meta
export type { DocMeta } from "./meta";

// Inline nodes
export type { Text, Mark } from "./inline/text";
export type { CitationRef } from "./inline/citation-ref";
export type { XRef } from "./inline/xref";
export type { InlineFormula } from "./inline/inline-formula";
export type { FootnoteRef } from "./inline/footnote-ref";
export type { InlineNode } from "./inline";

// Block nodes
export type { Section } from "./block/section";
export type { Paragraph, ParagraphRole, ParagraphOverrides } from "./block/paragraph";
export type { Figure, FigureAsset, SubFigure } from "./block/figure";
export type { Table, TableCell, TableRow } from "./block/table";
export type { Formula } from "./block/formula";
export type { Cover } from "./block/cover";
export type { Abstract } from "./block/abstract";
export type { ToCPlaceholder } from "./block/toc";
export type { Acknowledgements } from "./block/acknowledgements";
export type { Declaration } from "./block/declaration";
export type { Appendix } from "./block/appendix";
export type { ReferenceListPlaceholder } from "./block/ref-list-placeholder";
export type { PageBreak } from "./block/page-break";
export type { BlockNode } from "./block";

// Resources
export type { Person } from "./resource/person";
export type { ReferenceType, ReferenceItem } from "./resource/reference";
export type { AssetRef } from "./resource/asset-ref";
export type { FootnoteContent } from "./resource/footnote";

// Style
export type { StyleProfile } from "./style/profile";
export type { FontFamily, FontFamilies } from "./style/fonts";
export type { NumberingStyle, NumberingLevel, NumberingScheme, NumberingSchemes } from "./style/numbering";
export type { SectionStyle, SectionStyles } from "./style/section-style";
export type { ParagraphStyle, ParagraphStyles } from "./style/paragraph-style";
export type { FigureStyle } from "./style/figure-style";
export type { TableStyle } from "./style/table-style";
export type { AbstractStyle } from "./style/abstract-style";
export type { CoverStyle, CoverFieldStyle } from "./style/cover-style";
export type { CitationStyleConfig } from "./style/citation-style";

// Patch
export type { DocumentPatch } from "./patch/types";

// Runtime validators
export { validateDoc, isValidDoc, validateStyleProfile, isValidStyleProfile } from "./schemas/validators";
export { DocSchema, DocMetaSchema } from "./schemas/doc-schema";
export { StyleProfileSchema } from "./schemas/style-schemas";
