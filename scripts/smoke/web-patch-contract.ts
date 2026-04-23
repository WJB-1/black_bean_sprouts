import { createEmptyDoc, applyBatch, createBatch } from "@black-bean-sprouts/doc-schema";

async function main() {
  console.log("smoke:web-patch-contract - Testing web patch round-trip...");
  const doc = createEmptyDoc("Web Contract Test");

  // Simulate what PatchFirstPlugin would produce
  const patches = [
    { op: "insert" as const, parentId: "root", index: 0, block: { type: "heading" as const, id: "wh1", level: 1, children: [{ type: "text" as const, text: "Web Title" }] } },
    { op: "insert" as const, parentId: "root", index: 1, block: { type: "paragraph" as const, id: "wp1", children: [{ type: "text" as const, text: "Web content" }] } },
  ];

  const batch = createBatch(doc.version, patches);
  const result = applyBatch(doc, batch);

  if (!result.ok) { console.error("FAIL: applyBatch rejected web patches"); process.exit(1); }
  if (result.doc.version !== 1) { console.error("FAIL: version not bumped"); process.exit(1); }
  if (result.doc.children.length !== 2) { console.error("FAIL: expected 2 children"); process.exit(1); }

  // Verify heading block
  const heading = result.doc.children[0];
  if (heading.type !== "heading") { console.error("FAIL: first child not heading"); process.exit(1); }

  // Verify paragraph block
  const para = result.doc.children[1];
  if (para.type !== "paragraph") { console.error("FAIL: second child not paragraph"); process.exit(1); }

  console.log("PASS: web patch contract satisfied, version=" + result.doc.version);
}
main().catch(e => { console.error(e); process.exit(1); });
