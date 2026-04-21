// @doc-schema-version: 1.0.0
import { Type } from "@sinclair/typebox";

// ── Inline Schemas ──

export const MarkSchema = Type.Union([
  Type.Object({ type: Type.Literal("bold") }),
  Type.Object({ type: Type.Literal("italic") }),
  Type.Object({ type: Type.Literal("underline") }),
  Type.Object({ type: Type.Literal("strikethrough") }),
  Type.Object({ type: Type.Literal("superscript") }),
  Type.Object({ type: Type.Literal("subscript") }),
  Type.Object({ type: Type.Literal("link"), attrs: Type.Object({ href: Type.String() }) }),
]);

export const TextSchema = Type.Object({
  type: Type.Literal("text"),
  text: Type.String(),
  marks: Type.Optional(Type.Array(MarkSchema)),
});

export const CitationRefSchema = Type.Object({
  type: Type.Literal("citation_ref"),
  attrs: Type.Object({
    refId: Type.String(),
    prefix: Type.Optional(Type.String()),
    suffix: Type.Optional(Type.String()),
  }),
});

export const XRefSchema = Type.Object({
  type: Type.Literal("xref"),
  attrs: Type.Object({
    targetId: Type.String(),
    kind: Type.Union([
      Type.Literal("figure"),
      Type.Literal("table"),
      Type.Literal("formula"),
      Type.Literal("section"),
    ]),
    display: Type.Union([
      Type.Literal("number"),
      Type.Literal("full"),
      Type.Literal("page"),
    ]),
  }),
});

export const InlineFormulaSchema = Type.Object({
  type: Type.Literal("inline_formula"),
  attrs: Type.Object({ latex: Type.String() }),
});

export const FootnoteRefSchema = Type.Object({
  type: Type.Literal("footnote_ref"),
  attrs: Type.Object({ fnId: Type.String() }),
});

export const InlineNodeSchema = Type.Union([
  TextSchema,
  CitationRefSchema,
  XRefSchema,
  InlineFormulaSchema,
  FootnoteRefSchema,
]);
