// @doc-schema-version: 1.0.0
import { Type } from "@sinclair/typebox";
import { BlockNodeSchema } from "./block-schemas.js";
import { InlineNodeSchema } from "./inline-schemas.js";
import { AssetRefSchema, ReferenceItemSchema } from "./resource-schemas.js";

export const DocumentPatchSchema = Type.Union([
  Type.Object({
    op: Type.Literal("insert_block"),
    parentId: Type.String(),
    index: Type.Number(),
    node: BlockNodeSchema,
  }),
  Type.Object({
    op: Type.Literal("remove_block"),
    id: Type.String(),
  }),
  Type.Object({
    op: Type.Literal("move_block"),
    id: Type.String(),
    newParentId: Type.String(),
    newIndex: Type.Number(),
  }),
  Type.Object({
    op: Type.Literal("update_block_attrs"),
    id: Type.String(),
    attrs: Type.Record(Type.String(), Type.Any()),
  }),
  Type.Object({
    op: Type.Literal("update_text"),
    paragraphId: Type.String(),
    content: Type.Array(InlineNodeSchema),
  }),
  Type.Object({
    op: Type.Literal("upsert_reference"),
    ref: ReferenceItemSchema,
  }),
  Type.Object({
    op: Type.Literal("remove_reference"),
    refId: Type.String(),
  }),
  Type.Object({
    op: Type.Literal("upsert_asset"),
    asset: AssetRefSchema,
  }),
  Type.Object({
    op: Type.Literal("remove_asset"),
    assetId: Type.String(),
  }),
  Type.Object({
    op: Type.Literal("update_meta"),
    meta: Type.Record(Type.String(), Type.Any()),
  }),
  Type.Object({
    op: Type.Literal("apply_style_profile"),
    profileId: Type.String(),
  }),
]);

export const DocumentPatchArraySchema = Type.Array(DocumentPatchSchema);
