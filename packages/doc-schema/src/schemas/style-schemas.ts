// @doc-schema-version: 1.0.0
import { Type } from "@sinclair/typebox";

// ── Font Schemas ──

export const FontFamilySchema = Type.Object({
  eastAsian: Type.String(),
  latin: Type.String(),
  fallback: Type.Optional(Type.Array(Type.String())),
});

export const FontFamiliesSchema = Type.Object({
  body: FontFamilySchema,
  heading: FontFamilySchema,
  caption: FontFamilySchema,
  monospace: FontFamilySchema,
  baseSize: Type.Number(),
});

// ── Numbering Schemas ──

export const NumberingStyleSchema = Type.Union([
  Type.Literal("arabic"), Type.Literal("chinese"), Type.Literal("chinese-upper"),
  Type.Literal("roman-lower"), Type.Literal("roman-upper"),
  Type.Literal("letter-lower"), Type.Literal("letter-upper"),
]);

export const NumberingLevelSchema = Type.Object({
  style: NumberingStyleSchema,
  startAt: Type.Optional(Type.Number()),
});

export const NumberingSchemeSchema = Type.Object({
  levels: Type.Array(NumberingLevelSchema),
  resetOn: Type.Union([Type.Literal("section1"), Type.Literal("section2"), Type.Literal("none")]),
  format: Type.String(),
  prefix: Type.Optional(Type.String()),
  suffix: Type.Optional(Type.String()),
});

export const NumberingSchemesSchema = Type.Object({
  section: Type.Array(NumberingSchemeSchema),
  figure: NumberingSchemeSchema,
  table: NumberingSchemeSchema,
  formula: NumberingSchemeSchema,
  appendix: NumberingSchemeSchema,
  reference: NumberingSchemeSchema,
});

// ── Section Style ──

export const SectionStyleSchema = Type.Object({
  font: Type.Optional(Type.String()),
  size: Type.Optional(Type.Number()),
  bold: Type.Optional(Type.Boolean()),
  align: Type.Optional(Type.Union([
    Type.Literal("left"), Type.Literal("center"), Type.Literal("right"),
  ])),
  spaceBefore: Type.Optional(Type.String()),
  spaceAfter: Type.Optional(Type.String()),
  color: Type.Optional(Type.String()),
});

// ── Paragraph Style ──

export const ParagraphStyleSchema = Type.Object({
  font: Type.Optional(Type.String()),
  size: Type.Optional(Type.Number()),
  lineHeight: Type.Optional(Type.Number()),
  firstLineIndent: Type.Optional(Type.String()),
  align: Type.Optional(Type.Union([
    Type.Literal("justify"), Type.Literal("left"), Type.Literal("center"),
  ])),
  spaceBefore: Type.Optional(Type.String()),
  spaceAfter: Type.Optional(Type.String()),
});

// ── Citation Style ──

export const CitationStyleConfigSchema = Type.Object({
  cslStyleKey: Type.String(),
  locale: Type.Union([Type.Literal("zh-CN"), Type.Literal("en-US")]),
});

// ── StyleProfile ──

export const StyleProfileSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  docTypeCode: Type.String(),
  version: Type.String(),
  extends: Type.Optional(Type.String()),
  page: Type.Object({
    size: Type.Union([Type.Literal("A4"), Type.Literal("B5"), Type.Literal("letter")]),
    orientation: Type.Union([Type.Literal("portrait"), Type.Literal("landscape")]),
    margin: Type.Object({
      top: Type.String(),
      bottom: Type.String(),
      left: Type.String(),
      right: Type.String(),
    }),
  }),
  fonts: FontFamiliesSchema,
  numbering: NumberingSchemesSchema,
  nodes: Type.Object({
    section: Type.Record(Type.String(), SectionStyleSchema),
    paragraph: Type.Record(Type.String(), ParagraphStyleSchema),
    figure: Type.Object({
      captionPosition: Type.Union([Type.Literal("below"), Type.Literal("above")]),
      captionStyle: ParagraphStyleSchema,
      defaultWidth: Type.Optional(Type.String()),
      spacing: Type.Optional(Type.String()),
    }),
    table: Type.Object({
      captionPosition: Type.Union([Type.Literal("above"), Type.Literal("below")]),
      captionStyle: ParagraphStyleSchema,
      defaultBorder: Type.Union([Type.Literal("full"), Type.Literal("three-line"), Type.Literal("none")]),
      headerBold: Type.Optional(Type.Boolean()),
    }),
    abstract: Type.Object({
      titleStyle: SectionStyleSchema,
      bodyStyle: ParagraphStyleSchema,
      keywordsStyle: ParagraphStyleSchema,
      pageBreakAfter: Type.Optional(Type.Boolean()),
    }),
    cover: Type.Object({
      layout: Type.Union([Type.Literal("from-template"), Type.Literal("centered"), Type.Literal("custom")]),
      fields: Type.Optional(Type.Array(Type.Object({
        name: Type.String(),
        font: Type.Optional(Type.String()),
        size: Type.Optional(Type.Number()),
        align: Type.Optional(Type.Union([
          Type.Literal("left"), Type.Literal("center"), Type.Literal("right"),
        ])),
        bold: Type.Optional(Type.Boolean()),
        position: Type.Optional(Type.String()),
      }))),
    }),
    formula: Type.Object({ numberingFormat: Type.String() }),
    referenceList: Type.Object({ hangingIndent: Type.String(), fontSize: Type.Number() }),
  }),
  citation: CitationStyleConfigSchema,
  baseDocxTemplateKey: Type.Optional(Type.String()),
  thumbnailKey: Type.Optional(Type.String()),
  isActive: Type.Boolean(),
});
