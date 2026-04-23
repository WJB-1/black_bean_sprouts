import { createEmptyDoc, createBatch, applyBatch, isPatchConflictError } from "@black-bean-sprouts/doc-schema";
console.log("smoke:patch-conflict - Testing version conflict...");
const doc = createEmptyDoc("Test");
const stale = createBatch(99, [{ op: "insert", parentId: "root", index: 0, block: { type: "paragraph", id: "p1", children: [{ type: "text", text: "X" }] } }]);
const result = applyBatch(doc, stale);
if (result.ok) { console.error("FAIL: should have conflicted"); process.exit(1); }
if (!isPatchConflictError(result.error)) { console.error("FAIL: wrong error type"); process.exit(1); }
console.log("PASS: version conflict detected");
