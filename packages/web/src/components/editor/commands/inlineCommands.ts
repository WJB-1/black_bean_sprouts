// ============================================================================
// Inline Commands — High-level inline/text manipulation commands
// These create editor commands that the PatchFirstPlugin compiles into patches.
// ============================================================================

import type { Editor } from "@tiptap/vue-3";
import type {
  InlineNode,
  TextMark,
} from "@black-bean-sprouts/doc-schema";
import type {
  InsertInlineCommand,
  RemoveInlineCommand,
  ReplaceInlineCommand,
  InsertTextCommand,
  DeleteTextCommand,
  ReplaceTextCommand,
  ToggleMarkCommand,
} from "./types.js";

// ---- Inline Insertion ----

export function insertInline(
  blockId: string,
  index: number,
  inline: InlineNode,
): InsertInlineCommand {
  return { type: "insertInline", blockId, index, inline };
}

// ---- Inline Removal ----

export function removeInline(
  blockId: string,
  index: number,
  count: number = 1,
): RemoveInlineCommand {
  return { type: "removeInline", blockId, index, count };
}

// ---- Inline Replacement ----

export function replaceInline(
  blockId: string,
  index: number,
  count: number,
  inline: InlineNode,
): ReplaceInlineCommand {
  return { type: "replaceInline", blockId, index, count, inline };
}

// ---- Text Operations ----

export function insertText(
  blockId: string,
  inlineIndex: number,
  text: string,
  marks?: readonly TextMark[],
): InsertTextCommand {
  return { type: "insertText", blockId, inlineIndex, text, marks };
}

export function deleteText(
  blockId: string,
  inlineIndex: number,
  count: number,
): DeleteTextCommand {
  return { type: "deleteText", blockId, inlineIndex, count };
}

export function replaceText(
  blockId: string,
  inlineIndex: number,
  count: number,
  text: string,
  marks?: readonly TextMark[],
): ReplaceTextCommand {
  return { type: "replaceText", blockId, inlineIndex, count, text, marks };
}

// ---- Mark Toggle ----

export function toggleMark(
  blockId: string,
  markType: TextMark["type"],
  fromInlineIndex: number,
  toInlineIndex: number,
): ToggleMarkCommand {
  return {
    type: "toggleMark",
    blockId,
    markType,
    fromInlineIndex,
    toInlineIndex,
  };
}

// ---- Tiptap Integration Helpers ----
// These functions execute inline commands directly on the Tiptap editor.
// Use for programmatic editor manipulation where you control both sides.

export function executeInsertText(
  editor: Editor,
  from: number,
  text: string,
): void {
  editor.chain().focus().insertContentAt({ from, to: from }, text).run();
}

export function executeDeleteText(
  editor: Editor,
  from: number,
  to: number,
): void {
  editor.chain().focus().deleteRange({ from, to }).run();
}

export function executeReplaceText(
  editor: Editor,
  from: number,
  to: number,
  text: string,
): void {
  editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, text).run();
}

export function executeToggleBold(editor: Editor): void {
  editor.chain().focus().toggleBold().run();
}

export function executeToggleItalic(editor: Editor): void {
  editor.chain().focus().toggleItalic().run();
}

export function executeToggleStrike(editor: Editor): void {
  editor.chain().focus().toggleStrike().run();
}

export function executeToggleCode(editor: Editor): void {
  editor.chain().focus().toggleCode().run();
}

export function executeToggleUnderline(editor: Editor): void {
  (editor.chain().focus() as any).toggleUnderline().run();
}

export function executeToggleSuperscript(editor: Editor): void {
  (editor.chain().focus() as any).toggleSuperscript().run();
}

export function executeToggleSubscript(editor: Editor): void {
  (editor.chain().focus() as any).toggleSubscript().run();
}

/**
 * Extract the mark types currently active on a given selection range.
 * Useful for determining which toolbar buttons should appear active.
 */
export function getActiveMarks(editor: Editor): Set<TextMark["type"]> {
  const marks = new Set<TextMark["type"]>();
  const { state } = editor;
  const { from, to, empty } = state.selection;

  if (empty) {
    // Check stored marks (cursor position)
    const storedMarks = state.storedMarks;
    if (storedMarks) {
      for (const mark of storedMarks) {
        if (isKnownMarkType(mark.type.name)) {
          marks.add(mark.type.name as TextMark["type"]);
        }
      }
    }
  } else {
    // Check marks across the selection
    state.doc.nodesBetween(from, to, (node: { isText: boolean; marks: readonly { type: { name: string } }[] }) => {
      if (node.isText) {
        for (const mark of node.marks) {
          if (isKnownMarkType(mark.type.name)) {
            marks.add(mark.type.name as TextMark["type"]);
          }
        }
      }
    });
  }

  return marks;
}

const KNOWN_MARK_TYPES: ReadonlySet<string> = new Set([
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
  "superscript",
  "subscript",
]);

function isKnownMarkType(name: string): boolean {
  return KNOWN_MARK_TYPES.has(name);
}
