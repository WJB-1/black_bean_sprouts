// @doc-schema-version: 1.0.0
/**
 * Doc-engine render test
 *
 * Tests the DocxRenderer.render() method with a minimal Doc AST.
 * Verifies that a valid .docx buffer is produced.
 */

import { DocxRenderer } from "../src/renderer/docx-renderer.js";
import { defaultStyleProfile } from "../src/style-resolver/defaults.js";
import { NumberingResolver } from "../src/numbering/resolver.js";
import { CitationFormatter } from "../src/citation/formatter.js";

// Types imported for type checking
import type { Doc, Section, Paragraph, Text } from "@black-bean-sprouts/doc-schema";

/**
 * Constructs a minimal Doc AST for testing.
 */
function createMinimalDoc(): Doc {
  const doc: Doc = {
    type: "doc",
    schemaVersion: "1.0.0",
    attrs: {
      title: "测试文档",
      authors: [{ family: "张", given: "三" }],
      docLanguage: "zh",
    },
    content: [
      {
        id: "sec-1",
        type: "section",
        attrs: { level: 1, title: "第一章 绪论" },
        content: [
          {
            id: "para-1",
            type: "paragraph",
            attrs: { role: "normal" },
            content: [
              { type: "text", text: "这是测试段落内容。" },
            ],
          },
        ],
      },
    ],
    references: {},
    assets: {},
    footnotes: {},
  };
  return doc;
}

/**
 * Test harness
 */
async function runTest(): Promise<void> {
  console.log("=== Doc-Engine Render Test ===\n");

  // Step 1: Create minimal Doc AST
  console.log("Step 1: Creating minimal Doc AST...");
  const doc = createMinimalDoc();
  console.log("  ✓ Doc AST created");
  console.log(`    Title: ${doc.attrs.title}`);
  console.log(`    Language: ${doc.attrs.docLanguage}`);
  console.log(`    Content nodes: ${doc.content.length}`);

  // Step 2: Setup render options
  console.log("\nStep 2: Setting up render options...");
  const numberingResolver = new NumberingResolver();
  const citationFormatter = new CitationFormatter();

  const options = {
    styleProfile: defaultStyleProfile,
    numberingResolver,
    citationFormatter,
    loadAsset: async (storageKey: string) => {
      console.log(`    Mock loading asset: ${storageKey}`);
      return Buffer.from("");
    },
  };
  console.log("  ✓ Render options configured");

  // Step 3: Call DocxRenderer.render()
  console.log("\nStep 3: Calling DocxRenderer.render()...");
  const renderer = new DocxRenderer();
  let buffer: Buffer;
  try {
    buffer = await renderer.render(doc, options);
    console.log("  ✓ Render completed");
  } catch (error) {
    console.error("  ✗ Render failed:", error);
    console.log("\n=== FAIL ===");
    process.exit(1);
    return; // unreachable but satisfies type checker
  }

  // Step 4: Verify output
  console.log("\nStep 4: Verifying output...");

  const checks: { name: string; pass: boolean }[] = [];

  // Check 1: Buffer is non-empty
  const nonEmpty = buffer.length > 0;
  checks.push({ name: "Buffer is non-empty", pass: nonEmpty });
  console.log(`  Buffer size: ${buffer.length} bytes`);

  // Check 2: Buffer starts with ZIP/Word magic bytes "PK"
  const header = buffer.subarray(0, 2).toString("ascii");
  const hasMagic = header === "PK";
  checks.push({ name: "Valid ZIP magic bytes (PK)", pass: hasMagic });
  console.log(`  Magic bytes: ${header} ${hasMagic ? "✓" : "✗"}`);

  // Summary
  console.log("\n=== Test Results ===");
  let allPassed = true;
  for (const check of checks) {
    console.log(`  ${check.pass ? "✓" : "✗"} ${check.name}`);
    if (!check.pass) allPassed = false;
  }

  if (allPassed) {
    console.log("\n=== PASS ===");
    process.exit(0);
  } else {
    console.log("\n=== FAIL ===");
    process.exit(1);
  }
}

// Run the test
runTest().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
