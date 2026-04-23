// ============================================================================
// PatchFirstPlugin — Simplified bridge from Tiptap editor to DocumentPatchBatch
// ============================================================================

import type { Editor } from "@tiptap/vue-3";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type {
  DocumentPatchBatch,
  DocumentPatch,
  BlockNode,
  InlineNode,
  TextMark,
  ParagraphBlock,
  HeadingBlock,
  SectionBlock,
  Doc,
} from "@black-bean-sprouts/doc-schema";
import { createBatch } from "@black-bean-sprouts/doc-schema";

// ============================================================================
// Types
// ============================================================================

export type PatchFirstPluginOptions = {
  readonly getDoc: () => Doc;
  readonly onPatches: (batch: DocumentPatchBatch) => void;
};

// ============================================================================
// PatchFirstPlugin
// ============================================================================

/**
 * Simplified plugin that converts Tiptap editor changes to DocumentPatchBatch.
 * Uses Tiptap's onUpdate callback for simple before/after comparison.
 */
export class PatchFirstPlugin {
  private readonly editor: Editor;
  private readonly getDoc: () => Doc;
  private readonly onPatches: (batch: DocumentPatchBatch) => void;

  constructor(editor: Editor, options: PatchFirstPluginOptions) {
    this.editor = editor;
    this.getDoc = options.getDoc;
    this.onPatches = options.onPatches;

    // Listen for editor updates
    this.editor.on("update", this.handleUpdate);
  }

  private handleUpdate = ({ transaction }: { transaction: { docChanged: boolean; before: ProseMirrorNode; doc: ProseMirrorNode } }): void => {
    if (!transaction.docChanged) return;

    const doc = this.getDoc();
    const patches = this.computePatches(transaction.before, transaction.doc);
    if (patches.length === 0) return;

    const batch = createBatch(doc.version, patches, "user");
    this.onPatches(batch);
  };

  private computePatches(before: ProseMirrorNode, after: ProseMirrorNode): DocumentPatch[] {
    const patches: DocumentPatch[] = [];

    // Simple approach: compare top-level block structure
    const beforeIds = this.collectBlockIds(before);
    const afterIds = this.collectBlockIds(after);

    // Removed blocks
    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        patches.push({ op: "remove", blockId: id });
      }
    }

    // Inserted or replaced blocks
    after.forEach((node: ProseMirrorNode, _offset: number, index: number) => {
      const block = this.proseMirrorToBlock(node);
      if (!block) return;

      if (!beforeIds.has(block.id)) {
        patches.push({ op: "insert", parentId: "root", index, block });
      } else {
        // Check if inline content changed - emit replace for the block
        const beforeNode = this.findNodeById(before, block.id);
        if (beforeNode && this.contentChanged(beforeNode, node)) {
          patches.push({ op: "replace", blockId: block.id, block });
        }
      }
    });

    return patches;
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  /** Collect all block IDs from top-level nodes. */
  private collectBlockIds(doc: ProseMirrorNode): Set<string> {
    const ids = new Set<string>();
    doc.forEach((node: ProseMirrorNode) => {
      const id = node.attrs.id as string | undefined;
      if (id) ids.add(id);
    });
    return ids;
  }

  /** Find a node by its attrs.id. */
  private findNodeById(doc: ProseMirrorNode, id: string): ProseMirrorNode | null {
    let found: ProseMirrorNode | null = null;
    doc.forEach((node: ProseMirrorNode) => {
      if (node.attrs.id === id) found = node;
    });
    return found;
  }

  /** Check if content changed between two nodes. */
  private contentChanged(before: ProseMirrorNode, after: ProseMirrorNode): boolean {
    return before.textContent !== after.textContent;
  }

  /** Convert ProseMirror node to BlockNode. */
  private proseMirrorToBlock(node: ProseMirrorNode): BlockNode | null {
    const id = node.attrs.id as string | undefined;
    if (!id) return null;

    const type = node.type.name;

    switch (type) {
      case "paragraph":
        return this.createParagraphBlock(id, node);
      case "heading":
        return this.createHeadingBlock(id, node);
      case "section":
        return this.createSectionBlock(id, node);
      default:
        return null;
    }
  }

  private createParagraphBlock(id: string, node: ProseMirrorNode): ParagraphBlock {
    return {
      type: "paragraph",
      id,
      children: this.proseMirrorToInlines(node),
    };
  }

  private createHeadingBlock(id: string, node: ProseMirrorNode): HeadingBlock {
    const level = node.attrs.level as number ?? 1;
    return {
      type: "heading",
      id,
      level: Math.min(Math.max(level, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6,
      children: this.proseMirrorToInlines(node),
    };
  }

  private createSectionBlock(id: string, node: ProseMirrorNode): SectionBlock {
    return {
      type: "section",
      id,
      title: node.attrs.title as string ?? "",
      children: [],
    };
  }

  /** Extract inline content from text blocks. */
  private proseMirrorToInlines(node: ProseMirrorNode): InlineNode[] {
    const inlines: InlineNode[] = [];

    node.forEach((child: ProseMirrorNode) => {
      if (child.isText) {
        const text = child.text ?? "";
        const marks = this.extractMarksFromNode(child);
        inlines.push({ type: "text", text, marks });
      }
    });

    return inlines;
  }

  /** Convert ProseMirror marks to TextMark[]. */
  private extractMarksFromNode(node: ProseMirrorNode): TextMark[] {
    const marks: TextMark[] = [];
    const knownTypes: TextMark["type"][] = ["bold", "italic", "underline", "strikethrough", "code", "superscript", "subscript"];

    for (const mark of node.marks) {
      const typeName = mark.type.name;
      if (knownTypes.includes(typeName as TextMark["type"])) {
        marks.push({ type: typeName as TextMark["type"] });
      }
    }

    return marks;
  }

  destroy(): void {
    this.editor.off("update", this.handleUpdate);
  }
}
