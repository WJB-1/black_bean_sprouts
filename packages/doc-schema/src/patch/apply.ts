// @doc-schema-version: 1.0.0
import type { BlockNode } from "../block/index.js";
import type { Doc } from "../doc.js";
import type { InlineNode } from "../inline/index.js";
import type { DocumentPatch } from "./types.js";
import { containsBlock, findBlock, insertBlock, removeBlock } from "./block-tree.js";
import { DocumentPatchError } from "./errors.js";

export function applyDocumentPatches(doc: Doc, patches: readonly DocumentPatch[]): Doc {
  const nextDoc = structuredClone(doc);
  for (const patch of patches) {
    applyDocumentPatch(nextDoc, patch);
  }
  return nextDoc;
}

function applyDocumentPatch(doc: Doc, patch: DocumentPatch): void {
  switch (patch.op) {
    case "insert_block":
      insertBlock(doc.content, patch.parentId, patch.index, patch.node);
      return;
    case "remove_block":
      removeBlock(doc.content, patch.id);
      return;
    case "move_block":
      moveBlock(doc.content, patch.id, patch.newParentId, patch.newIndex);
      return;
    case "update_block_attrs":
      updateBlockAttrs(doc.content, patch.id, patch.attrs);
      return;
    case "update_text":
      updateParagraphText(doc.content, patch.paragraphId, patch.content);
      return;
    case "update_meta":
      updateDocMeta(doc, patch.meta);
      return;
    case "upsert_reference":
      doc.references[patch.ref.id] = structuredClone(patch.ref);
      return;
    case "remove_reference":
      delete doc.references[patch.refId];
      return;
    case "upsert_asset":
      doc.assets[patch.asset.id] = structuredClone(patch.asset);
      return;
    case "remove_asset":
      delete doc.assets[patch.assetId];
      return;
    case "apply_style_profile":
      return;
  }
}

function updateDocMeta(doc: Doc, meta: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(meta)) {
    if (value === null) {
      Reflect.deleteProperty(doc.attrs, key);
      continue;
    }
    Reflect.set(doc.attrs, key, value);
  }
}

function moveBlock(
  rootBlocks: BlockNode[],
  id: string,
  newParentId: string,
  newIndex: number,
): void {
  const target = findBlock(rootBlocks, id);
  if (!target) {
    throw new DocumentPatchError(`Block not found: ${id}`);
  }
  if (newParentId === id || containsBlock(target, newParentId)) {
    throw new DocumentPatchError(`Cannot move block ${id} into its own subtree`);
  }
  const removed = removeBlock(rootBlocks, id);
  insertBlock(rootBlocks, newParentId, newIndex, removed);
}

function updateBlockAttrs(
  rootBlocks: BlockNode[],
  id: string,
  attrs: Record<string, unknown>,
): void {
  const block = findBlock(rootBlocks, id);
  if (!block) {
    throw new DocumentPatchError(`Block not found: ${id}`);
  }
  assignBlockAttrs(block, attrs);
}

function assignBlockAttrs(block: BlockNode, attrs: Record<string, unknown>): void {
  switch (block.type) {
    case "page_break":
    case "acknowledgements":
    case "declaration":
      throw new DocumentPatchError(`Block does not have attrs: ${block.id}`);
    case "toc_placeholder":
    case "reference_list_placeholder":
      block.attrs ??= {};
      Object.assign(block.attrs, attrs);
      return;
    default:
      Object.assign(block.attrs, attrs);
  }
}

function updateParagraphText(
  rootBlocks: BlockNode[],
  paragraphId: string,
  content: InlineNode[],
): void {
  const block = findBlock(rootBlocks, paragraphId);
  if (!block) {
    throw new DocumentPatchError(`Paragraph not found: ${paragraphId}`);
  }
  if (block.type !== "paragraph") {
    throw new DocumentPatchError(`Block is not a paragraph: ${paragraphId}`);
  }
  block.content = structuredClone(content);
}
