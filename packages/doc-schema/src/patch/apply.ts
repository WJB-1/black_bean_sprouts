import type { Doc, BlockNode, SectionBlock, InlineNode, TableBlock, ReferenceListBlock } from "../doc/types.js";
import type {
  DocumentPatch, InsertBlockPatch, RemoveBlockPatch, MoveBlockPatch, ReplaceBlockPatch,
  InsertInlinePatch, RemoveInlinePatch, ReplaceInlinePatch,
  InsertTableRowPatch, RemoveTableRowPatch, ReplaceTableCellPatch,
  AddReferencePatch, RemoveReferencePatch, UpdateReferencePatch
} from "./types.js";
import type { DocumentPatchBatch, PatchConflictError } from "./batch.js";
import { createPatchConflictError } from "./batch.js";

export type ApplyError = {
  readonly type: "ApplyError";
  readonly message: string;
  readonly patch: DocumentPatch;
};

function createApplyError(message: string, patch: DocumentPatch): ApplyError {
  return { type: "ApplyError", message, patch };
}

export function isApplyError(error: unknown): error is ApplyError {
  return typeof error === "object" && error !== null && (error as ApplyError).type === "ApplyError";
}

export type ApplyBatchResult =
  | { readonly ok: true; readonly doc: Doc }
  | { readonly ok: false; readonly error: PatchConflictError | ApplyError };

export function applyBatch(doc: Doc, batch: DocumentPatchBatch): ApplyBatchResult {
  if (doc.version !== batch.expectedVersion) {
    return { ok: false, error: createPatchConflictError(batch.expectedVersion, doc.version) };
  }
  let current: Doc = doc;
  for (const patch of batch.patches) {
    const result = applyPatch(current, patch);
    if (result.ok) { current = result.doc; }
    else { return { ok: false, error: result.error }; }
  }
  return { ok: true, doc: { ...current, version: current.version + 1 } };
}

export type ApplyPatchResult =
  | { readonly ok: true; readonly doc: Doc }
  | { readonly ok: false; readonly error: ApplyError };

export function applyPatch(doc: Doc, patch: DocumentPatch): ApplyPatchResult {
  switch (patch.op) {
    case "insert": return applyInsert(doc, patch);
    case "remove": return applyRemove(doc, patch);
    case "move": return applyMove(doc, patch);
    case "replace": return applyReplace(doc, patch);
    case "updateMetadata": return { ok: true, doc: { ...doc, metadata: { ...doc.metadata, ...patch.metadata } } };
    case "insertInline": return applyInsertInline(doc, patch);
    case "removeInline": return applyRemoveInline(doc, patch);
    case "replaceInline": return applyReplaceInline(doc, patch);
    case "insertTableRow": return applyInsertTableRow(doc, patch);
    case "removeTableRow": return applyRemoveTableRow(doc, patch);
    case "replaceTableCell": return applyReplaceTableCell(doc, patch);
    case "addReference": return applyAddReference(doc, patch);
    case "removeReference": return applyRemoveReference(doc, patch);
    case "updateReference": return applyUpdateReference(doc, patch);
    default: return { ok: false, error: createApplyError("Unknown patch op", patch) };
  }
}

function applyInsert(doc: Doc, patch: InsertBlockPatch): ApplyPatchResult {
  if (patch.parentId === "root") {
    const children = [...doc.children];
    if (patch.index < 0 || patch.index > children.length) {
      return { ok: false, error: createApplyError("Invalid insert index", patch) };
    }
    children.splice(patch.index, 0, patch.block);
    return { ok: true, doc: { ...doc, children } };
  }
  const children = mapBlocks(doc.children, (block) => {
    if (block.type === "section" && block.id === patch.parentId) {
      const ch = [...block.children];
      if (patch.index < 0 || patch.index > ch.length) return block;
      ch.splice(patch.index, 0, patch.block);
      return { ...block, children: ch } as SectionBlock;
    }
    return block;
  });
  return { ok: true, doc: { ...doc, children } };
}

function applyRemove(doc: Doc, patch: RemoveBlockPatch): ApplyPatchResult {
  const idx = doc.children.findIndex((b) => b.id === patch.blockId);
  if (idx !== -1) {
    const children = [...doc.children];
    children.splice(idx, 1);
    return { ok: true, doc: { ...doc, children } };
  }
  const children = mapBlocks(doc.children, (block) => {
    if (block.type !== "section") return block;
    const i = block.children.findIndex((b) => b.id === patch.blockId);
    if (i === -1) return block;
    const ch = [...block.children];
    ch.splice(i, 1);
    return { ...block, children: ch } as SectionBlock;
  });
  return { ok: true, doc: { ...doc, children } };
}

function applyMove(doc: Doc, patch: MoveBlockPatch): ApplyPatchResult {
  const target = findBlock(doc.children, patch.blockId);
  if (!target) return { ok: false, error: createApplyError("Block not found for move", patch) };
  const removed = applyRemove(doc, { op: "remove", blockId: patch.blockId });
  if (!removed.ok) return removed;
  return applyInsert(removed.doc, { op: "insert", parentId: patch.targetParentId, index: patch.targetIndex, block: target });
}

function applyReplace(doc: Doc, patch: ReplaceBlockPatch): ApplyPatchResult {
  const idx = doc.children.findIndex((b) => b.id === patch.blockId);
  if (idx !== -1) {
    const children = [...doc.children];
    children[idx] = patch.block;
    return { ok: true, doc: { ...doc, children } };
  }
  const children = mapBlocks(doc.children, (block) => {
    if (block.type !== "section") return block;
    const i = block.children.findIndex((b) => b.id === patch.blockId);
    if (i === -1) return block;
    const ch = [...block.children];
    ch[i] = patch.block;
    return { ...block, children: ch } as SectionBlock;
  });
  return { ok: true, doc: { ...doc, children } };
}

type InlineUpdater = (inlines: readonly InlineNode[]) => readonly InlineNode[] | null;

function applyInsertInline(doc: Doc, patch: InsertInlinePatch): ApplyPatchResult {
  return updateInlines(doc, patch.blockId, (inlines) => {
    const n = [...inlines]; n.splice(patch.index, 0, patch.inline); return n;
  });
}
function applyRemoveInline(doc: Doc, patch: RemoveInlinePatch): ApplyPatchResult {
  return updateInlines(doc, patch.blockId, (inlines) => {
    const n = [...inlines]; n.splice(patch.index, 1); return n;
  });
}
function applyReplaceInline(doc: Doc, patch: ReplaceInlinePatch): ApplyPatchResult {
  return updateInlines(doc, patch.blockId, (inlines) => {
    if (patch.index < 0 || patch.index >= inlines.length) return null;
    const n = [...inlines]; n[patch.index] = patch.inline; return n;
  });
}

function applyInsertTableRow(doc: Doc, patch: InsertTableRowPatch): ApplyPatchResult {
  return updateTable(doc, patch.tableId, (t) => { const r=[...t.rows]; r.splice(patch.index,0,patch.row); return {...t,rows:r}; });
}
function applyRemoveTableRow(doc: Doc, patch: RemoveTableRowPatch): ApplyPatchResult {
  return updateTable(doc, patch.tableId, (t) => { const r=[...t.rows]; r.splice(patch.index,1); return {...t,rows:r}; });
}
function applyReplaceTableCell(doc: Doc, patch: ReplaceTableCellPatch): ApplyPatchResult {
  return updateTable(doc, patch.tableId, (t) => ({
    ...t, rows: t.rows.map(r => r.id !== patch.rowId ? r : { ...r, cells: r.cells.map(c => c.id === patch.cellId ? patch.cell : c) })
  }));
}

function applyAddReference(doc: Doc, patch: AddReferencePatch): ApplyPatchResult {
  return updateRefList(doc, patch.listId, (l) => ({ ...l, items: [...l.items, patch.item] }));
}
function applyRemoveReference(doc: Doc, patch: RemoveReferencePatch): ApplyPatchResult {
  return updateRefList(doc, patch.listId, (l) => ({ ...l, items: l.items.filter(i => i.id !== patch.itemId) }));
}
function applyUpdateReference(doc: Doc, patch: UpdateReferencePatch): ApplyPatchResult {
  return updateRefList(doc, patch.listId, (l) => ({ ...l, items: l.items.map(i => i.id === patch.itemId ? patch.item : i) }));
}

function findBlock(blocks: readonly BlockNode[], id: string): BlockNode | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "section") { const f = findBlock(b.children, id); if (f) return f; }
  }
  return undefined;
}

function mapBlocks(blocks: readonly BlockNode[], fn: (b: BlockNode) => BlockNode): BlockNode[] {
  return blocks.map(fn);
}

function updateInlines(doc: Doc, blockId: string, updater: InlineUpdater): ApplyPatchResult {
  const children = mapBlocks(doc.children, (block) => {
    if (block.id === blockId && (block.type === "paragraph" || block.type === "heading")) {
      const r = updater(block.children); if (!r) return block;
      return { ...block, children: r } as BlockNode;
    }
    if (block.type === "section") {
      return { ...block, children: mapBlocks(block.children, (c) => {
        if (c.id === blockId && (c.type === "paragraph" || c.type === "heading")) {
          const r = updater(c.children); if (!r) return c;
          return { ...c, children: r } as BlockNode;
        }
        return c;
      }) } as SectionBlock;
    }
    return block;
  });
  return { ok: true, doc: { ...doc, children } };
}

function updateTable(doc: Doc, tableId: string, fn: (t: TableBlock) => TableBlock): ApplyPatchResult {
  const children = mapBlocks(doc.children, (b) => {
    if (b.type === "table" && b.id === tableId) return fn(b);
    if (b.type === "section") return { ...b, children: mapBlocks(b.children, c => c.type === "table" && c.id === tableId ? fn(c) : c) } as SectionBlock;
    return b;
  });
  return { ok: true, doc: { ...doc, children } };
}

function updateRefList(doc: Doc, listId: string, fn: (l: ReferenceListBlock) => ReferenceListBlock): ApplyPatchResult {
  const children = mapBlocks(doc.children, (b) => {
    if (b.type === "reference-list" && b.id === listId) return fn(b);
    if (b.type === "section") return { ...b, children: mapBlocks(b.children, c => c.type === "reference-list" && c.id === listId ? fn(c) : c) } as SectionBlock;
    return b;
  });
  return { ok: true, doc: { ...doc, children } };
}
