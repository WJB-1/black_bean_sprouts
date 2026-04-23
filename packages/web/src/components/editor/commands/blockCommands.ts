// ============================================================================
// Block Commands — High-level block manipulation commands
// These create editor commands that the PatchFirstPlugin compiles into patches.
// ============================================================================

import type { Editor } from "@tiptap/vue-3";
import type {
  BlockNode,
  HeadingBlock,
  SectionBlock,
  ParagraphBlock,
} from "@black-bean-sprouts/doc-schema";
import type {
  InsertBlockCommand,
  RemoveBlockCommand,
  MoveBlockCommand,
  ReplaceBlockCommand,
  SetHeadingLevelCommand,
  SetSectionTitleCommand,
} from "./types.js";

// ---- Helpers ----

let blockIdCounter = 0;

function generateBlockId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++blockIdCounter}`;
}

// ---- Block Insertion ----

export function insertParagraph(
  parentId: string,
  index: number,
  text: string = "",
): InsertBlockCommand {
  const block: ParagraphBlock = {
    type: "paragraph",
    id: generateBlockId("para"),
    children: text ? [{ type: "text", text }] : [],
  };
  return { type: "insertBlock", parentId, index, block };
}

export function insertHeading(
  parentId: string,
  index: number,
  level: HeadingBlock["level"],
  text: string = "",
): InsertBlockCommand {
  const block: HeadingBlock = {
    type: "heading",
    id: generateBlockId("head"),
    level,
    children: text ? [{ type: "text", text }] : [],
  };
  return { type: "insertBlock", parentId, index, block };
}

export function insertSection(
  parentId: string,
  index: number,
  title: string,
  children: readonly BlockNode[] = [],
): InsertBlockCommand {
  const block: SectionBlock = {
    type: "section",
    id: generateBlockId("sec"),
    title,
    children,
  };
  return { type: "insertBlock", parentId, index, block };
}

export function insertCustomBlock(
  parentId: string,
  index: number,
  block: BlockNode,
): InsertBlockCommand {
  return { type: "insertBlock", parentId, index, block };
}

// ---- Block Removal ----

export function removeBlock(blockId: string): RemoveBlockCommand {
  return { type: "removeBlock", blockId };
}

// ---- Block Movement ----

export function moveBlock(
  blockId: string,
  targetParentId: string,
  targetIndex: number,
): MoveBlockCommand {
  return { type: "moveBlock", blockId, targetParentId, targetIndex };
}

// ---- Block Replacement ----

export function replaceBlock(
  blockId: string,
  block: BlockNode,
): ReplaceBlockCommand {
  return { type: "replaceBlock", blockId, block };
}

// ---- Heading Level Changes ----

export function setHeadingLevel(
  blockId: string,
  level: HeadingBlock["level"],
): SetHeadingLevelCommand {
  return { type: "setHeadingLevel", blockId, level };
}

// ---- Section Title Changes ----

export function setSectionTitle(
  blockId: string,
  title: string,
): SetSectionTitleCommand {
  return { type: "setSectionTitle", blockId, title };
}

// ---- Tiptap Integration Helpers ----
// These functions execute block commands directly on the Tiptap editor.
// They do NOT go through the patch pipeline — use them only for
// programmatic editor manipulation where you control both sides.

export function executeInsertParagraphAfter(
  editor: Editor,
  blockId: string,
  text: string = "",
): void {
  editor
    .chain()
    .focus()
    .insertContentAt(
      editor.state.selection.to,
      `<p data-block-id="${generateBlockId("para")}">${text}</p>`,
    )
    .run();
}

export function executeToggleHeading(
  editor: Editor,
  level: 1 | 2 | 3 | 4 | 5 | 6,
): void {
  editor.chain().focus().toggleHeading({ level }).run();
}

export function executeSplitBlock(editor: Editor): void {
  editor.chain().focus().splitBlock().run();
}

export function executeDeleteBlock(editor: Editor, pos: number): void {
  const { state } = editor;
  const $pos = state.doc.resolve(pos);
  const nodeStart = $pos.before($pos.depth);
  const nodeEnd = $pos.after($pos.depth);
  editor.chain().focus().deleteRange({ from: nodeStart, to: nodeEnd }).run();
}

export function executeMoveBlockUp(editor: Editor, pos: number): void {
  const { state } = editor;
  const $pos = state.doc.resolve(pos);
  const depth = $pos.depth;
  const index = $pos.index(depth);
  if (index === 0) return;

  const parent = $pos.node(depth);
  const nodeBefore = parent.child(index - 1);
  const nodeCurrent = parent.child(index);

  const beforeStart = $pos.start(depth) + $pos.parentOffset -
    nodeBefore.nodeSize;
  const currentEnd = $pos.start(depth) + $pos.parentOffset +
    nodeCurrent.nodeSize;

  const tr = state.tr.delete(
    $pos.start(depth) + $pos.parentOffset - nodeBefore.nodeSize,
    $pos.start(depth) + $pos.parentOffset + nodeCurrent.nodeSize,
  );
  const insertPos = beforeStart;
  tr.insert(insertPos, nodeCurrent);
  tr.insert(insertPos + nodeCurrent.nodeSize, nodeBefore);

  editor.view.dispatch(tr);
}
