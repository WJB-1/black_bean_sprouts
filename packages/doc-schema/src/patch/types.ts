// @doc-schema-version: 1.0.0
import type { BlockNode } from "../block/index.js";
import type { InlineNode } from "../inline/index.js";
import type { ReferenceItem } from "../resource/reference.js";
import type { AssetRef } from "../resource/asset-ref.js";

export type DocumentPatch =
  | { op: "insert_block"; parentId: string; index: number; node: BlockNode }
  | { op: "remove_block"; id: string }
  | { op: "move_block"; id: string; newParentId: string; newIndex: number }
  | { op: "update_block_attrs"; id: string; attrs: Record<string, unknown> }
  | { op: "update_text"; paragraphId: string; content: InlineNode[] }
  | { op: "upsert_reference"; ref: ReferenceItem }
  | { op: "remove_reference"; refId: string }
  | { op: "upsert_asset"; asset: AssetRef }
  | { op: "remove_asset"; assetId: string }
  | { op: "update_meta"; meta: Record<string, unknown> }
  | { op: "apply_style_profile"; profileId: string };
