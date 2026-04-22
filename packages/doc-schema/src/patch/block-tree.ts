// @doc-schema-version: 1.0.0
import type { BlockNode, Paragraph } from "../block/index.js";
import { DocumentPatchError } from "./errors.js";

export function findBlock(blocks: BlockNode[], id: string): BlockNode | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block;
    }
    const children = getBlockChildren(block);
    if (!children) {
      continue;
    }
    const found = findBlock(children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

export function insertBlock(
  rootBlocks: BlockNode[],
  parentId: string,
  index: number,
  node: BlockNode,
): void {
  const siblings = resolveMutableChildren(rootBlocks, parentId, node);
  assertValidInsertIndex(index, siblings.length, parentId);
  siblings.splice(index, 0, structuredClone(node));
}

export function removeBlock(rootBlocks: BlockNode[], id: string): BlockNode {
  const removed = removeBlockFromList(rootBlocks, id);
  if (!removed) {
    throw new DocumentPatchError(`Block not found: ${id}`);
  }
  return removed;
}

export function containsBlock(block: BlockNode, id: string): boolean {
  if (block.id === id) {
    return true;
  }
  const children = getBlockChildren(block);
  return children ? children.some((child) => containsBlock(child, id)) : false;
}

function removeBlockFromList(blocks: BlockNode[], id: string): BlockNode | null {
  const index = blocks.findIndex((block) => block.id === id);
  if (index >= 0) {
    const removed = blocks.splice(index, 1)[0];
    if (removed === undefined) {
      throw new DocumentPatchError(`Failed to remove block: ${id}`);
    }
    return removed;
  }

  for (const block of blocks) {
    const children = getBlockChildren(block);
    if (!children) {
      continue;
    }
    const removed = removeBlockFromList(children, id);
    if (removed) {
      return removed;
    }
  }
  return null;
}

function resolveMutableChildren(
  rootBlocks: BlockNode[],
  parentId: string,
  node: BlockNode,
): BlockNode[] {
  if (parentId === "root") {
    return rootBlocks;
  }
  const parent = findBlock(rootBlocks, parentId);
  if (!parent) {
    throw new DocumentPatchError(`Parent block not found: ${parentId}`);
  }
  return getMutableBlockChildren(parent, node);
}

function getMutableBlockChildren(parent: BlockNode, node: BlockNode): BlockNode[] {
  if (parent.type === "abstract" && !isParagraph(node)) {
    throw new DocumentPatchError("Abstract can only contain paragraph blocks");
  }
  const children = getBlockChildren(parent);
  if (!children) {
    throw new DocumentPatchError(`Block cannot contain child blocks: ${parent.id}`);
  }
  return children;
}

function getBlockChildren(block: BlockNode): BlockNode[] | null {
  switch (block.type) {
    case "section":
    case "cover":
    case "appendix":
    case "abstract":
      return block.content;
    default:
      return null;
  }
}

function isParagraph(node: BlockNode): node is Paragraph {
  return node.type === "paragraph";
}

function assertValidInsertIndex(index: number, length: number, parentId: string): void {
  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw new DocumentPatchError(`Invalid insert index ${index} for parent ${parentId}`);
  }
}
