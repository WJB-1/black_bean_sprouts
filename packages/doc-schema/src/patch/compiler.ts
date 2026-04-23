import type { Doc, BlockNode, ParagraphBlock, SectionBlock, HeadingBlock } from "../doc/types.js";
import type { DocumentPatch } from "./types.js";
import type { DocumentPatchBatch } from "./batch.js";
import { createBatch } from "./batch.js";

export type PatchIntent =
  | { op: "insertSection"; parentId: string; index: number; title: string; paragraphs?: string[] }
  | { op: "insertParagraph"; parentId: string; index: number; text: string }
  | { op: "insertHeading"; parentId: string; index: number; level: 1|2|3|4|5|6; text: string }
  | { op: "removeBlock"; blockId: string }
  | { op: "moveBlock"; blockId: string; targetParentId: string; targetIndex: number }
  | { op: "updateTitle"; blockId: string; newTitle: string }
  | { op: "insertText"; blockId: string; index: number; text: string }
  | { op: "removeText"; blockId: string; index: number; count: number }
  | { op: "replaceText"; blockId: string; index: number; count: number; text: string };

let idCounter = 0;
function genId(prefix: string): string {
  return prefix + "_" + Date.now() + "_" + (++idCounter);
}

export type PatchCompiler = {
  compile(intent: PatchIntent, doc: Doc): DocumentPatchBatch;
};

export const patchCompiler: PatchCompiler = {
  compile(intent, doc) {
    const patches: DocumentPatch[] = [];
    switch (intent.op) {
      case "insertSection": {
        const paragraphs: ParagraphBlock[] = (intent.paragraphs ?? []).map((text) => ({
          type: "paragraph" as const,
          id: genId("p"),
          children: [{ type: "text" as const, text }],
        }));
        const section: SectionBlock = { type: "section", id: genId("sec"), title: intent.title, children: paragraphs };
        patches.push({ op: "insert", parentId: intent.parentId, index: intent.index, block: section });
        break;
      }
      case "insertParagraph": {
        const para: ParagraphBlock = { type: "paragraph", id: genId("p"), children: [{ type: "text", text: intent.text }] };
        patches.push({ op: "insert", parentId: intent.parentId, index: intent.index, block: para });
        break;
      }
      case "insertHeading": {
        const heading: HeadingBlock = { type: "heading", id: genId("h"), level: intent.level, children: [{ type: "text", text: intent.text }] };
        patches.push({ op: "insert", parentId: intent.parentId, index: intent.index, block: heading });
        break;
      }
      case "removeBlock": { patches.push({ op: "remove", blockId: intent.blockId }); break; }
      case "moveBlock": { patches.push({ op: "move", blockId: intent.blockId, targetParentId: intent.targetParentId, targetIndex: intent.targetIndex }); break; }
      case "updateTitle": {
        const existing = findBlockInTree(doc.children, intent.blockId);
        if (existing && existing.type === "section") {
          patches.push({ op: "replace", blockId: intent.blockId, block: { ...existing, title: intent.newTitle } });
        }
        break;
      }
      case "insertText": { patches.push({ op: "insertInline", blockId: intent.blockId, index: intent.index, inline: { type: "text", text: intent.text } }); break; }
      case "removeText": { for (let i = 0; i < intent.count; i++) patches.push({ op: "removeInline", blockId: intent.blockId, index: intent.index }); break; }
      case "replaceText": {
        for (let i = 0; i < intent.count; i++) patches.push({ op: "removeInline", blockId: intent.blockId, index: intent.index });
        patches.push({ op: "insertInline", blockId: intent.blockId, index: intent.index, inline: { type: "text", text: intent.text } });
        break;
      }
    }
    return createBatch(doc.version, patches);
  },
};

function findBlockInTree(blocks: readonly BlockNode[], id: string): BlockNode | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "section") { const f = findBlockInTree(b.children, id); if (f) return f; }
  }
  return undefined;
}
