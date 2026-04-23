import { createEmptyDoc, applyBatch, createBatch } from "@black-bean-sprouts/doc-schema";
import { DocxRenderer } from "@black-bean-sprouts/doc-engine";

async function main() {
  console.log("test:docx-snapshots - Testing DOCX render structural correctness...");
  const renderer = new DocxRenderer();

  type Case = { name: string; patches: ReturnType<typeof createBatch>["patches"]; minSize: number };
  const cases: Case[] = [
    { name: "empty-doc", patches: [], minSize: 4000 },
    { name: "heading-paragraph", patches: [
      { op: "insert", parentId: "root", index: 0, block: { type: "heading", id: "h1", level: 1, children: [{ type: "text", text: "Introduction" }] } },
      { op: "insert", parentId: "root", index: 1, block: { type: "paragraph", id: "p1", children: [{ type: "text", text: "Body text here." }] } },
    ], minSize: 5000 },
    { name: "section-with-table", patches: [
      { op: "insert", parentId: "root", index: 0, block: { type: "section", id: "s1", title: "Methods", children: [
        { type: "table", id: "t1", rows: [
          { id: "tr1", cells: [{ id: "tc1", children: [{ type: "paragraph", id: "p2", children: [{ type: "text", text: "Cell A" }] }] }, { id: "tc2", children: [{ type: "paragraph", id: "p3", children: [{ type: "text", text: "Cell B" }] }] }] },
        ] },
      ] } },
    ], minSize: 6000 },
  ];

  let pass = 0;
  for (const c of cases) {
    const doc = createEmptyDoc("Snapshot: " + c.name);
    const batch = createBatch(doc.version, c.patches);
    const patched = applyBatch(doc, batch);
    if (!patched.ok) { console.error("FAIL: " + c.name + " patch failed"); process.exit(1); }

    const result = await renderer.render(patched.doc);

    // Verify valid ZIP (DOCX) magic bytes
    if (result.buffer[0] !== 0x50 || result.buffer[1] !== 0x4B) {
      console.error("FAIL: " + c.name + " not a valid ZIP/DOCX");
      process.exit(1);
    }

    // Verify minimum size (structural sanity check)
    if (result.size < c.minSize) {
      console.error("FAIL: " + c.name + " too small: " + result.size + " < " + c.minSize);
      process.exit(1);
    }

    // Verify size matches reported size
    if (result.buffer.length !== result.size) {
      console.error("FAIL: " + c.name + " buffer size mismatch");
      process.exit(1);
    }

    console.log("  " + c.name + ": " + result.size + " bytes, ZIP OK");
    pass++;
  }

  console.log("PASS: " + pass + " DOCX renders structurally correct");
}
main().catch(e => { console.error(e); process.exit(1); });
