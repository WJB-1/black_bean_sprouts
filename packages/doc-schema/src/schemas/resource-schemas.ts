// @doc-schema-version: 1.0.0
import { Type } from "@sinclair/typebox";

// ── Person ──

export const PersonSchema = Type.Object({
  family: Type.String(),
  given: Type.String(),
  literal: Type.Optional(Type.String()),
  suffix: Type.Optional(Type.String()),
  orcid: Type.Optional(Type.String()),
});

// ── ReferenceItem (CSL-JSON aligned) ──

export const ReferenceTypeSchema = Type.Union([
  Type.Literal("article-journal"), Type.Literal("article"),
  Type.Literal("book"), Type.Literal("chapter"),
  Type.Literal("thesis"), Type.Literal("webpage"),
  Type.Literal("dataset"), Type.Literal("preprint"),
  Type.Literal("paper-conference"), Type.Literal("report"),
  Type.Literal("patent"),
]);

export const ReferenceItemSchema = Type.Object({
  id: Type.String(),
  type: ReferenceTypeSchema,
  authors: Type.Array(PersonSchema),
  editors: Type.Optional(Type.Array(PersonSchema)),
  title: Type.String(),
  subtitle: Type.Optional(Type.String()),
  shortTitle: Type.Optional(Type.String()),
  "container-title": Type.Optional(Type.String()),
  "collection-title": Type.Optional(Type.String()),
  issued: Type.Optional(Type.Object({
    "date-parts": Type.Array(Type.Array(Type.Number())),
  })),
  publisher: Type.Optional(Type.String()),
  "publisher-place": Type.Optional(Type.String()),
  volume: Type.Optional(Type.String()),
  issue: Type.Optional(Type.String()),
  page: Type.Optional(Type.String()),
  "number-of-pages": Type.Optional(Type.Number()),
  DOI: Type.Optional(Type.String()),
  URL: Type.Optional(Type.String()),
  ISBN: Type.Optional(Type.String()),
  PMID: Type.Optional(Type.String()),
  PMCID: Type.Optional(Type.String()),
  abstract: Type.Optional(Type.String()),
  keyword: Type.Optional(Type.Array(Type.String())),
  language: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
});

// ── AssetRef ──

export const AssetRefSchema = Type.Object({
  id: Type.String(),
  kind: Type.Union([
    Type.Literal("image"), Type.Literal("chart"),
    Type.Literal("ai_generated"), Type.Literal("attachment"),
  ]),
  storageKey: Type.String(),
  mimeType: Type.String(),
  meta: Type.Object({
    width: Type.Optional(Type.Number()),
    height: Type.Optional(Type.Number()),
    prompt: Type.Optional(Type.String()),
    source: Type.Optional(Type.String()),
    altText: Type.Optional(Type.String()),
  }),
});
