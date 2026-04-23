import { createEmptyDoc, createBatch, applyBatch, isApplyError } from "@black-bean-sprouts/doc-schema";
console.log("smoke:patch - Testing patch apply...");
const doc = createEmptyDoc("Test");
const batch = createBatch(doc.version, [{ op: "insert", parentId: "root", index: 0, block: { type: "paragraph", id: "p1", children: [{ type: "text", text: "Hello" }] } }]);
const result = applyBatch(doc, batch);
if (!result.ok) { console.error("FAIL: patch apply failed"); process.exit(1); }
if (result.doc.version !== 1) { console.error("FAIL: version not bumped"); process.exit(1); }
console.log("PASS: patch apply works, version=" + result.doc.version);
