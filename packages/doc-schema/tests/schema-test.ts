#!/usr/bin/env node
// @doc-schema-version: 1.0.0
/**
 * Functional test for doc-schema package
 * Constructs a complete Doc AST JSON and validates it with TypeBox validators
 */

import { validateDoc, isValidDoc } from "../dist/index.js";

// Construct a minimal but realistic Doc AST
const testDoc = {
  type: "doc",
  schemaVersion: "1.0.0",
  attrs: {
    title: "测试论文",
    authors: [{ family: "张", given: "三" }],
    docLanguage: "zh",
  },
  content: [
    {
      id: "sec-1",
      type: "section",
      attrs: { level: 1, title: "绪论", label: "sec:intro" },
      content: [
        {
          id: "para-1",
          type: "paragraph",
          attrs: { role: "normal" },
          content: [
            { type: "text", text: "这是第一段测试内容。" },
            { type: "citation_ref", attrs: { refId: "ref-1" } },
          ],
        },
      ],
    },
    {
      id: "fig-1",
      type: "figure",
      attrs: {
        caption: "测试图",
        label: "fig:test",
        layout: "single",
        asset: { assetId: "asset-1" },
      },
    },
    {
      id: "tab-1",
      type: "table",
      attrs: {
        caption: "测试表",
        label: "tab:test",
        borderStyle: "three-line",
      },
      content: [
        {
          cells: [
            { content: [{ type: "text", text: "数据" }], header: true },
          ],
        },
        {
          cells: [
            { content: [{ type: "text", text: "值" }] },
          ],
        },
      ],
    },
  ],
  references: {
    "ref-1": {
      id: "ref-1",
      type: "article-journal",
      authors: [{ family: "李", given: "四" }],
      title: "测试论文",
      "container-title": "测试期刊",
      issued: { "date-parts": [[2024, 1, 1]] },
      volume: "1",
      issue: "1",
      page: "1-10",
    },
  },
  assets: {
    "asset-1": {
      id: "asset-1",
      kind: "image",
      storageKey: "test/image.png",
      mimeType: "image/png",
      meta: { width: 800, height: 600 },
    },
  },
  footnotes: {},
};

// Run validation
console.log("Testing doc-schema validation...\n");

try {
  const isValid = isValidDoc(testDoc);

  if (isValid) {
    console.log("PASS: Doc AST validation succeeded");
    process.exit(0);
  } else {
    console.log("FAIL: Doc AST validation failed");
    console.log("\nValidation errors:");
    if (validateDoc.errors) {
      for (const error of validateDoc.errors) {
        console.log(`  - ${error.instancePath}: ${error.message}`);
        if (error.params) {
          console.log(`    Params: ${JSON.stringify(error.params)}`);
        }
      }
    }
    process.exit(1);
  }
} catch (error) {
  console.log("FAIL: Unexpected error during validation");
  console.error(error);
  process.exit(1);
}
