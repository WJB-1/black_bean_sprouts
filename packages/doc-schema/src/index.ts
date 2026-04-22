// @doc-schema-version: 1.0.0

// Version
export { SCHEMA_VERSION } from "./version.js";
export type { SchemaVersion } from "./version.js";

// Base
export type { BlockBase, InlineBase } from "./base.js";

// Doc
export type { Doc } from "./doc.js";

// Meta
export type { DocMeta } from "./meta.js";

// Inline nodes
export type { Text, Mark } from "./inline/text.js";
export type { CitationRef } from "./inline/citation-ref.js";
export type { XRef } from "./inline/xref.js";
export type { InlineFormula } from "./inline/inline-formula.js";
export type { FootnoteRef } from "./inline/footnote-ref.js";
export type { InlineNode } from "./inline/index.js";

// Block nodes
export type { Section } from "./block/section.js";
export type { Paragraph, ParagraphRole, ParagraphOverrides } from "./block/paragraph.js";
export type { Figure, FigureAsset, SubFigure } from "./block/figure.js";
export type { Table, TableCell, TableRow } from "./block/table.js";
export type { Formula } from "./block/formula.js";
export type { Cover } from "./block/cover.js";
export type { Abstract } from "./block/abstract.js";
export type { ToCPlaceholder } from "./block/toc.js";
export type { Acknowledgements } from "./block/acknowledgements.js";
export type { Declaration } from "./block/declaration.js";
export type { Appendix } from "./block/appendix.js";
export type { ReferenceListPlaceholder } from "./block/ref-list-placeholder.js";
export type { PageBreak } from "./block/page-break.js";
export type { BlockNode } from "./block/index.js";

// Resources
export type { Person } from "./resource/person.js";
export type { ReferenceType, ReferenceItem } from "./resource/reference.js";
export type { AssetRef } from "./resource/asset-ref.js";
export type { FootnoteContent } from "./resource/footnote.js";

// Style
export type { StyleProfile } from "./style/profile.js";
export type { FontFamily, FontFamilies } from "./style/fonts.js";
export type { NumberingStyle, NumberingLevel, NumberingScheme, NumberingSchemes } from "./style/numbering.js";
export type { SectionStyle, SectionStyles } from "./style/section-style.js";
export type { ParagraphStyle, ParagraphStyles } from "./style/paragraph-style.js";
export type { FigureStyle } from "./style/figure-style.js";
export type { TableStyle } from "./style/table-style.js";
export type { AbstractStyle } from "./style/abstract-style.js";
export type { CoverStyle, CoverFieldStyle } from "./style/cover-style.js";
export type { CitationStyleConfig } from "./style/citation-style.js";

// Patch
export type { DocumentPatch } from "./patch/types.js";
export { applyDocumentPatches, DocumentPatchError } from "./patch/index.js";

// Runtime validators
export {
  validateDoc,
  validateDocumentPatch,
  validateDocumentPatchArray,
  isValidDoc,
  isValidDocumentPatch,
  isValidDocumentPatchArray,
  validateStyleProfile,
  isValidStyleProfile,
} from "./schemas/validators.js";
export { DocSchema, DocMetaSchema } from "./schemas/doc-schema.js";
export { DocumentPatchSchema, DocumentPatchArraySchema } from "./schemas/patch-schemas.js";
export { StyleProfileSchema } from "./schemas/style-schemas.js";
