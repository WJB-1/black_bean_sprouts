#!/usr/bin/env node
import { applyDocumentPatches } from "../dist/index.js";

const baseDoc = {
  type: "doc",
  schemaVersion: "1.0.0",
  attrs: {
    title: "Patch Smoke",
    subtitle: "Draft Subtitle",
    authors: [],
    docLanguage: "zh",
  },
  content: [
    {
      id: "section-a",
      type: "section",
      attrs: { level: 1, title: "Section A" },
      content: [],
    },
    {
      id: "section-b",
      type: "section",
      attrs: { level: 1, title: "Section B" },
      content: [],
    },
  ],
  references: {},
  assets: {},
  footnotes: {},
};

const paragraphNode = {
  id: "paragraph-1",
  type: "paragraph",
  attrs: { role: "normal" },
  content: [{ type: "text", text: "initial" }],
};

const nextDoc = applyDocumentPatches(baseDoc, [
  { op: "insert_block", parentId: "section-a", index: 0, node: paragraphNode },
  {
    op: "update_text",
    paragraphId: "paragraph-1",
    content: [{ type: "text", text: "patched text" }],
  },
  {
    op: "move_block",
    id: "paragraph-1",
    newParentId: "section-b",
    newIndex: 0,
  },
  {
    op: "upsert_reference",
    ref: {
      id: "ref-1",
      type: "article-journal",
      authors: [],
      title: "Reference One",
    },
  },
  {
    op: "upsert_asset",
    asset: {
      id: "asset-1",
      kind: "image",
      storageKey: "images/asset-1.png",
      mimeType: "image/png",
      meta: {},
    },
  },
  {
    op: "update_meta",
    meta: {
      title: "Patch Smoke Updated",
    },
  },
  {
    op: "update_meta",
    meta: {
      subtitle: null,
    },
  },
  {
    op: "apply_style_profile",
    profileId: "style-1",
  },
]);

const movedParagraph = nextDoc.content[1]?.content?.[0];

if (nextDoc.attrs.title !== "Patch Smoke Updated") {
  throw new Error("meta patch failed");
}
if ("subtitle" in nextDoc.attrs) {
  throw new Error("meta field clearing failed");
}
if (!movedParagraph || movedParagraph.type !== "paragraph") {
  throw new Error("move_block failed");
}
if (movedParagraph.content[0]?.type !== "text" || movedParagraph.content[0].text !== "patched text") {
  throw new Error("update_text failed");
}
if (!nextDoc.references["ref-1"]) {
  throw new Error("upsert_reference failed");
}
if (!nextDoc.assets["asset-1"]) {
  throw new Error("upsert_asset failed");
}

let invalidMovePassed = false;
try {
  applyDocumentPatches(baseDoc, [
    {
      op: "move_block",
      id: "section-a",
      newParentId: "section-a",
      newIndex: 0,
    },
  ]);
  invalidMovePassed = true;
} catch {
  invalidMovePassed = false;
}

if (invalidMovePassed) {
  throw new Error("invalid move should fail");
}

console.log("PASS: DocumentPatch smoke succeeded");
