// ============================================================================
// DocumentPatch — 原子文档操作
// 所有文档写入必须通过 DocumentPatchBatch (B1)
// ============================================================================

// ---- Patch Operations ----

export type InsertBlockPatch = {
  readonly op: "insert";
  readonly parentId: string;       // where to insert (doc root id "root" or section id)
  readonly index: number;          // position in parent's children
  readonly block: import("../doc/types.js").BlockNode;
};

export type RemoveBlockPatch = {
  readonly op: "remove";
  readonly blockId: string;
};

export type MoveBlockPatch = {
  readonly op: "move";
  readonly blockId: string;
  readonly targetParentId: string;
  readonly targetIndex: number;
};

export type ReplaceBlockPatch = {
  readonly op: "replace";
  readonly blockId: string;
  readonly block: import("../doc/types.js").BlockNode;
};

export type UpdateMetadataPatch = {
  readonly op: "updateMetadata";
  readonly metadata: Partial<import("../doc/types.js").DocMetadata>;
};

export type InsertInlinePatch = {
  readonly op: "insertInline";
  readonly blockId: string;        // paragraph or heading id
  readonly index: number;
  readonly inline: import("../doc/types.js").InlineNode;
};

export type RemoveInlinePatch = {
  readonly op: "removeInline";
  readonly blockId: string;
  readonly index: number;
};

export type ReplaceInlinePatch = {
  readonly op: "replaceInline";
  readonly blockId: string;
  readonly index: number;
  readonly inline: import("../doc/types.js").InlineNode;
};

// Table-specific patches
export type InsertTableRowPatch = {
  readonly op: "insertTableRow";
  readonly tableId: string;
  readonly index: number;
  readonly row: import("../doc/types.js").TableRow;
};

export type RemoveTableRowPatch = {
  readonly op: "removeTableRow";
  readonly tableId: string;
  readonly index: number;
};

export type ReplaceTableCellPatch = {
  readonly op: "replaceTableCell";
  readonly tableId: string;
  readonly rowId: string;
  readonly cellId: string;
  readonly cell: import("../doc/types.js").TableCell;
};

// Reference patches
export type AddReferencePatch = {
  readonly op: "addReference";
  readonly listId: string;
  readonly item: import("../doc/types.js").ReferenceItem;
};

export type RemoveReferencePatch = {
  readonly op: "removeReference";
  readonly listId: string;
  readonly itemId: string;
};

export type UpdateReferencePatch = {
  readonly op: "updateReference";
  readonly listId: string;
  readonly itemId: string;
  readonly item: import("../doc/types.js").ReferenceItem;
};

export type DocumentPatch =
  | InsertBlockPatch
  | RemoveBlockPatch
  | MoveBlockPatch
  | ReplaceBlockPatch
  | UpdateMetadataPatch
  | InsertInlinePatch
  | RemoveInlinePatch
  | ReplaceInlinePatch
  | InsertTableRowPatch
  | RemoveTableRowPatch
  | ReplaceTableCellPatch
  | AddReferencePatch
  | RemoveReferencePatch
  | UpdateReferencePatch;
