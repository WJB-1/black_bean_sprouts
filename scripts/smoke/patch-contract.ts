import { createBatch, applyBatch, createEmptyDoc, patchCompiler } from "@black-bean-sprouts/doc-schema";

async function main() {
  console.log("test:patch-contract - Testing DocumentPatchBatch contract...");

  // Verify PatchCompiler output matches DocumentPatchBatch structure
  const doc = createEmptyDoc("Contract Test");
  const batch = patchCompiler.compile({ op: "insertParagraph", parentId: "root", index: 0, text: "Hello" }, doc);

  if (typeof batch.expectedVersion !== "number") { console.error("FAIL: expectedVersion missing"); process.exit(1); }
  if (!Array.isArray(batch.patches)) { console.error("FAIL: patches not array"); process.exit(1); }
  if (batch.source !== "user") { console.error("FAIL: source not user"); process.exit(1); }
  console.log("  - PatchCompiler output structure: OK");

  // Verify applyBatch accepts PatchCompiler output
  const result = applyBatch(doc, batch);
  if (!result.ok) { console.error("FAIL: applyBatch rejected compiler output"); process.exit(1); }
  console.log("  - PatchCompiler output accepted by applyBatch: OK");

  // Verify version incremented
  if (result.doc.version !== 1) { console.error("FAIL: version not incremented"); process.exit(1); }
  console.log("  - Version incremented correctly: OK");

  console.log("PASS: patch contract verified");
}
main().catch(e => { console.error("FAIL:", e); process.exit(1); });
