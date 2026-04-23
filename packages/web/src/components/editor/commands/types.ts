// ============================================================================
// Command Types — Editor command definitions for block and inline manipulation
// Commands are high-level intents that the PatchFirstPlugin translates into
// DocumentPatchBatch objects via the patch compiler.
// ============================================================================

import type {
  BlockNode,
  InlineNode,
  TextMark,
  DocMetadata,
} from "@black-bean-sprouts/doc-schema";

// ---- Block Commands ----

export type InsertBlockCommand = {
  readonly type: "insertBlock";
  readonly parentId: string;
  readonly index: number;
  readonly block: BlockNode;
};

export type RemoveBlockCommand = {
  readonly type: "removeBlock";
  readonly blockId: string;
};

export type MoveBlockCommand = {
  readonly type: "moveBlock";
  readonly blockId: string;
  readonly targetParentId: string;
  readonly targetIndex: number;
};

export type ReplaceBlockCommand = {
  readonly type: "replaceBlock";
  readonly blockId: string;
  readonly block: BlockNode;
};

export type SetHeadingLevelCommand = {
  readonly type: "setHeadingLevel";
  readonly blockId: string;
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
};

export type SetSectionTitleCommand = {
  readonly type: "setSectionTitle";
  readonly blockId: string;
  readonly title: string;
};

// ---- Inline Commands ----

export type InsertInlineCommand = {
  readonly type: "insertInline";
  readonly blockId: string;
  readonly index: number;
  readonly inline: InlineNode;
};

export type RemoveInlineCommand = {
  readonly type: "removeInline";
  readonly blockId: string;
  readonly index: number;
  readonly count: number;
};

export type ReplaceInlineCommand = {
  readonly type: "replaceInline";
  readonly blockId: string;
  readonly index: number;
  readonly count: number;
  readonly inline: InlineNode;
};

export type InsertTextCommand = {
  readonly type: "insertText";
  readonly blockId: string;
  readonly inlineIndex: number;
  readonly text: string;
  readonly marks?: readonly TextMark[];
};

export type DeleteTextCommand = {
  readonly type: "deleteText";
  readonly blockId: string;
  readonly inlineIndex: number;
  readonly count: number;
};

export type ReplaceTextCommand = {
  readonly type: "replaceText";
  readonly blockId: string;
  readonly inlineIndex: number;
  readonly count: number;
  readonly text: string;
  readonly marks?: readonly TextMark[];
};

export type ToggleMarkCommand = {
  readonly type: "toggleMark";
  readonly blockId: string;
  readonly markType: TextMark["type"];
  readonly fromInlineIndex: number;
  readonly toInlineIndex: number;
};

// ---- Metadata Commands ----

export type UpdateMetadataCommand = {
  readonly type: "updateMetadata";
  readonly metadata: Partial<DocMetadata>;
};

// ---- Union of all editor commands ----

export type EditorCommand =
  | InsertBlockCommand
  | RemoveBlockCommand
  | MoveBlockCommand
  | ReplaceBlockCommand
  | SetHeadingLevelCommand
  | SetSectionTitleCommand
  | InsertInlineCommand
  | RemoveInlineCommand
  | ReplaceInlineCommand
  | InsertTextCommand
  | DeleteTextCommand
  | ReplaceTextCommand
  | ToggleMarkCommand
  | UpdateMetadataCommand;
