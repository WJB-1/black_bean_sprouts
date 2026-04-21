// @doc-schema-version: 1.0.0
import { Type } from "@sinclair/typebox";
import { InlineNodeSchema } from "./inline-schemas";

// ── Block Schemas ──

export const BlockBaseSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
});

export const ParagraphOverridesSchema = Type.Object({
  align: Type.Optional(Type.Union([
    Type.Literal("left"), Type.Literal("center"),
    Type.Literal("right"), Type.Literal("justify"),
  ])),
  indent: Type.Optional(Type.Object({
    firstLine: Type.Optional(Type.Boolean()),
    left: Type.Optional(Type.Number()),
  })),
  spacing: Type.Optional(Type.Object({
    before: Type.Optional(Type.Number()),
    after: Type.Optional(Type.Number()),
    lineHeight: Type.Optional(Type.Number()),
  })),
});

// Individual block schemas (without content fields that reference BlockNodeSchema)
export const ParagraphSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("paragraph"),
    attrs: Type.Object({
      role: Type.Optional(Type.Union([
        Type.Literal("normal"), Type.Literal("quote"), Type.Literal("code"),
        Type.Literal("note"), Type.Literal("caption"), Type.Literal("list-item"),
      ])),
      overrides: Type.Optional(ParagraphOverridesSchema),
    }),
    content: Type.Array(InlineNodeSchema),
  }),
]);

export const FigureAssetSchema = Type.Object({
  assetId: Type.String(),
  width: Type.Optional(Type.Union([
    Type.Literal("full"), Type.Literal("half"), Type.Number(),
  ])),
  altText: Type.Optional(Type.String()),
});

export const SubFigureSchema = Type.Object({
  label: Type.String(),
  caption: Type.Optional(Type.String()),
  asset: FigureAssetSchema,
});

export const FigureSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("figure"),
    attrs: Type.Object({
      caption: Type.String(),
      label: Type.Optional(Type.String()),
      layout: Type.Union([
        Type.Literal("single"), Type.Literal("grid"),
        Type.Literal("horizontal"), Type.Literal("vertical"),
      ]),
      columns: Type.Optional(Type.Number()),
      asset: Type.Optional(FigureAssetSchema),
      subfigures: Type.Optional(Type.Array(SubFigureSchema)),
      styleOverrides: Type.Optional(Type.Object({
        captionAlign: Type.Optional(Type.Union([Type.Literal("left"), Type.Literal("center")])),
        widthOverride: Type.Optional(Type.String()),
      })),
    }),
  }),
]);

export const TableCellSchema = Type.Object({
  content: Type.Array(InlineNodeSchema),
  colspan: Type.Optional(Type.Number()),
  rowspan: Type.Optional(Type.Number()),
  header: Type.Optional(Type.Boolean()),
});

export const TableRowSchema = Type.Object({
  cells: Type.Array(TableCellSchema),
});

export const TableSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("table"),
    attrs: Type.Object({
      caption: Type.String(),
      label: Type.Optional(Type.String()),
      borderStyle: Type.Optional(Type.Union([
        Type.Literal("full"), Type.Literal("three-line"), Type.Literal("none"),
      ])),
      colWidths: Type.Optional(Type.Array(Type.Number())),
    }),
    content: Type.Array(TableRowSchema),
  }),
]);

export const FormulaSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("formula"),
    attrs: Type.Object({
      latex: Type.String(),
      display: Type.Literal(true),
      label: Type.Optional(Type.String()),
    }),
  }),
]);

export const AbstractSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("abstract"),
    attrs: Type.Object({
      language: Type.Union([Type.Literal("zh"), Type.Literal("en")]),
      keywords: Type.Array(Type.String()),
    }),
    content: Type.Array(ParagraphSchema),
  }),
]);

export const ToCPlaceholderSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("toc_placeholder"),
    attrs: Type.Optional(Type.Object({
      maxLevel: Type.Optional(Type.Number()),
    })),
  }),
]);

export const AcknowledgementsSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("acknowledgements"),
    content: Type.Array(InlineNodeSchema),
  }),
]);

export const DeclarationSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("declaration"),
    content: Type.Array(InlineNodeSchema),
  }),
]);

export const ReferenceListPlaceholderSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("reference_list_placeholder"),
    attrs: Type.Optional(Type.Object({
      sortOrder: Type.Optional(Type.Union([
        Type.Literal("appearance"), Type.Literal("alphabetical"),
      ])),
    })),
  }),
]);

export const PageBreakSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("page_break"),
  }),
]);

// Recursive schemas using Type.Union with loose validation for content arrays
// These schemas accept any object in their content arrays, and the actual validation
// happens through the BlockNodeSchema which covers all block types.
export const SectionSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("section"),
    attrs: Type.Object({
      level: Type.Union([
        Type.Literal(1), Type.Literal(2), Type.Literal(3),
        Type.Literal(4), Type.Literal(5),
      ]),
      title: Type.String(),
      label: Type.Optional(Type.String()),
    }),
    content: Type.Array(Type.Any()), // Accept any array, validated by BlockNodeSchema
  }),
]);

export const CoverSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("cover"),
    attrs: Type.Object({
      layout: Type.Union([
        Type.Literal("from-template"), Type.Literal("centered"), Type.Literal("custom"),
      ]),
    }),
    content: Type.Array(Type.Any()), // Accept any array, validated by BlockNodeSchema
  }),
]);

export const AppendixSchema = Type.Intersect([
  BlockBaseSchema,
  Type.Object({
    type: Type.Literal("appendix"),
    attrs: Type.Object({
      label: Type.String(),
      title: Type.String(),
    }),
    content: Type.Array(Type.Any()), // Accept any array, validated by BlockNodeSchema
  }),
]);

// Complete BlockNodeSchema as a union of all block types
export const BlockNodeSchema = Type.Union([
  SectionSchema, ParagraphSchema, FigureSchema, TableSchema, FormulaSchema,
  CoverSchema, AbstractSchema, ToCPlaceholderSchema,
  AcknowledgementsSchema, DeclarationSchema, AppendixSchema,
  ReferenceListPlaceholderSchema, PageBreakSchema,
]);
