// @doc-schema-version: 1.0.0
import { Type } from "@sinclair/typebox";
import { PersonSchema } from "./resource-schemas.js";
import { ReferenceItemSchema, AssetRefSchema } from "./resource-schemas.js";
import { InlineNodeSchema } from "./inline-schemas.js";
import { BlockNodeSchema } from "./block-schemas.js";

// ── DocMeta Schema ──

export const DocMetaSchema = Type.Object({
  title: Type.String(),
  subtitle: Type.Optional(Type.String()),
  authors: Type.Array(PersonSchema),
  institution: Type.Optional(Type.String()),
  department: Type.Optional(Type.String()),
  advisor: Type.Optional(PersonSchema),
  date: Type.Optional(Type.String()),
  keywords: Type.Optional(Type.Array(Type.String())),
  docLanguage: Type.Union([Type.Literal("zh"), Type.Literal("en")]),
  degree: Type.Optional(Type.String()),
  major: Type.Optional(Type.String()),
  studentId: Type.Optional(Type.String()),
});

// ── Top-level Doc Schema ──

export const DocSchema = Type.Object({
  type: Type.Literal("doc"),
  schemaVersion: Type.String(),
  attrs: DocMetaSchema,
  content: Type.Array(BlockNodeSchema),
  references: Type.Record(Type.String(), ReferenceItemSchema),
  assets: Type.Record(Type.String(), AssetRefSchema),
  footnotes: Type.Record(Type.String(), Type.Array(InlineNodeSchema)),
  glossary: Type.Optional(Type.Record(Type.String(), Type.String())),
});
