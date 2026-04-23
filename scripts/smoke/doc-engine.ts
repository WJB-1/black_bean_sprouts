import { createEmptyDoc, applyBatch, createBatch } from "@black-bean-sprouts/doc-schema";
import { DocxRenderer } from "@black-bean-sprouts/doc-engine";
async function main() {
  console.log("smoke:doc-engine - Testing DOCX render...");
  const doc = createEmptyDoc("Smoke Test");
  const batch = createBatch(0, [{ op: "insert", parentId: "root", index: 0, block: { type: "paragraph", id: "p1", children: [{ type: "text", text: "Hello World" }] } }]);
  const patched = applyBatch(doc, batch);
  if (!patched.ok) { console.error("FAIL: patch failed"); process.exit(1); }
  const renderer = new DocxRenderer();
  const result = await renderer.render(patched.doc);
  if (!Buffer.isBuffer(result.buffer)) { console.error("FAIL: not a buffer"); process.exit(1); }
  if (result.buffer[0] !== 0x50 || result.buffer[1] !== 0x4B) { console.error("FAIL: not a valid ZIP/DOCX"); process.exit(1); }
  console.log("PASS: DOCX rendered, size=" + result.size + " bytes, ZIP magic OK");
}
main().catch(e => { console.error(e); process.exit(1); });
