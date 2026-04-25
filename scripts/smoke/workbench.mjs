import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const serverPackageJsonPath = path.join(repoRoot, "packages", "server", "package.json");
const routesDistPath = path.join(
  repoRoot,
  "packages",
  "server",
  "dist",
  "routes",
  "workbench",
  "index.js",
);
const serviceDistPath = path.join(
  repoRoot,
  "packages",
  "server",
  "dist",
  "services",
  "workbench-application.js",
);
const docSchemaDistPath = path.join(
  repoRoot,
  "packages",
  "doc-schema",
  "dist",
  "index.js",
);
const serverRequire = createRequire(pathToFileURL(serverPackageJsonPath));
const Fastify = serverRequire("fastify");

const SAMPLE_RAW_TEXT = [
  "Clinical nutrition pathway optimization study",
  "",
  "Abstract",
  "Goal: evaluate whether layered nutrition support improves inpatient recovery.",
  "Methods: compare routine management and enhanced nutrition support in 86 patients.",
  "Results: albumin improved and average stay was shortened by 2.3 days.",
  "Conclusion: the standardized pathway is worth promoting.",
  "",
  "1 Introduction",
  "Nutrition support is an important part of inpatient care.",
  "",
  "2 Study Design",
  "The study included 86 patients and compared two management strategies.",
  "",
  "3 Results",
  "The enhanced-support group showed better recovery indicators.",
].join("\n");

const FAKE_MODEL_OUTPUT = JSON.stringify(
  {
    title: "Clinical nutrition pathway optimization study",
    subtitle: "Workbench Smoke",
    institution: "Black Bean Sprouts Test Lab",
    keywords: ["nutrition support", "inpatient care", "study"],
    authors: [{ name: "Smoke Tester", affiliation: "Black Bean Sprouts" }],
    blocks: [
      {
        type: "abstract",
        paragraphs: [
          "Goal: evaluate whether layered nutrition support improves inpatient recovery.",
          "Conclusion: the standardized pathway is worth promoting.",
        ],
      },
      {
        type: "section",
        title: "Study Design",
        children: [
          {
            type: "paragraph",
            text: "The study included 86 patients and compared two management strategies.",
          },
          {
            type: "formula",
            latex: "N = 86",
            caption: "Sample size",
          },
          {
            type: "table",
            header: ["Group", "Cases"],
            rows: [
              ["Control", "43"],
              ["Enhanced support", "43"],
            ],
            caption: "Enrollment split",
          },
        ],
      },
      {
        type: "reference-list",
        items: [
          {
            key: "ref1",
            authors: ["A. Author"],
            title: "Nutrition pathway",
            year: 2024,
            source: "Journal of Test Data",
          },
        ],
      },
    ],
  },
  null,
  2,
);

function ensureBuiltArtifact(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }
  throw new Error(`Missing built artifact at ${filePath}. Build the workspace first.`);
}

async function loadRuntime() {
  ensureBuiltArtifact(routesDistPath);
  ensureBuiltArtifact(serviceDistPath);
  ensureBuiltArtifact(docSchemaDistPath);

  const [{ createWorkbenchRoutes }, { createWorkbenchApplicationService }, { isValidDoc }] =
    await Promise.all([
      import(pathToFileURL(routesDistPath).href),
      import(pathToFileURL(serviceDistPath).href),
      import(pathToFileURL(docSchemaDistPath).href),
    ]);

  return {
    createWorkbenchRoutes,
    createWorkbenchApplicationService,
    isValidDoc,
  };
}

function assertOk(condition, message, details) {
  if (condition) {
    return;
  }

  console.error(`FAIL: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function toBase64(value) {
  return Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(value, "utf8").toString("base64");
}

function inlineText(children = []) {
  return children
    .map((item) => {
      if (item?.type === "text") {
        return item.text ?? "";
      }
      if (item?.type === "hardBreak") {
        return "\n";
      }
      if (item?.type === "formula-inline") {
        return item.latex ?? "";
      }
      return "";
    })
    .join("")
    .trim();
}

function collectDocFragments(blocks) {
  const fragments = [];

  for (const block of blocks ?? []) {
    switch (block.type) {
      case "paragraph":
      case "heading": {
        const text = inlineText(block.children);
        if (text) {
          fragments.push(text);
        }
        break;
      }
      case "abstract": {
        for (const paragraph of block.children ?? []) {
          const text = inlineText(paragraph.children);
          if (text) {
            fragments.push(text);
          }
        }
        break;
      }
      case "section": {
        if (block.title) {
          fragments.push(block.title);
        }
        fragments.push(...collectDocFragments(block.children));
        break;
      }
      case "formula": {
        if (block.latex) {
          fragments.push(block.latex);
        }
        break;
      }
      case "table": {
        for (const cell of block.headerRow?.cells ?? []) {
          for (const child of cell.children ?? []) {
            const text = inlineText(child.children);
            if (text) {
              fragments.push(text);
            }
          }
        }
        for (const row of block.rows ?? []) {
          for (const cell of row.cells ?? []) {
            for (const child of cell.children ?? []) {
              const text = inlineText(child.children);
              if (text) {
                fragments.push(text);
              }
            }
          }
        }
        break;
      }
      case "figure": {
        if (block.alt) {
          fragments.push(block.alt);
        } else if (block.src) {
          fragments.push(block.src);
        }
        break;
      }
      case "reference-list": {
        for (const item of block.items ?? []) {
          if (item.title) {
            fragments.push(item.title);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return fragments
    .map((value) => String(value).trim())
    .filter((value) => value.length >= 6);
}

async function main() {
  console.log("smoke:workbench - Testing workbench import/generate/export flow...");

  const { createWorkbenchRoutes, createWorkbenchApplicationService, isValidDoc } = await loadRuntime();
  const app = Fastify({ logger: false });
  const workbenchService = createWorkbenchApplicationService({
    async runPrompt() {
      return FAKE_MODEL_OUTPUT;
    },
  });

  await app.register(createWorkbenchRoutes({ workbenchService }), { prefix: "/api/workbench" });

  try {
    const styleProfilesResponse = await app.inject({
      method: "GET",
      url: "/api/workbench/style-profiles",
    });

    assertOk(styleProfilesResponse.statusCode === 200, "style profiles route status", styleProfilesResponse.body);
    const styleProfiles = styleProfilesResponse.json();
    assertOk(Array.isArray(styleProfiles) && styleProfiles.length > 0, "style profiles route returned empty list");

    const textImportResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/import",
      payload: {
        fileName: "draft.txt",
        contentBase64: toBase64(SAMPLE_RAW_TEXT),
      },
    });

    assertOk(textImportResponse.statusCode === 200, "text import route status", textImportResponse.body);
    const importedText = textImportResponse.json();
    assertOk(importedText.sourceType === "text", "text import sourceType mismatch");
    assertOk(importedText.rawText.includes("Study Design"), "text import content mismatch");

    const generateResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/generate",
      payload: {
        title: "Smoke Title",
        rawText: importedText.rawText,
      },
    });

    assertOk(generateResponse.statusCode === 200, "generate route status", generateResponse.body);

    const generated = generateResponse.json();
    assertOk(!generated.degraded, "generate route degraded unexpectedly", generated.warning ?? generated.modelOutput);

    const validation = isValidDoc(generated.doc);
    assertOk(validation.ok, "generated doc invalid", validation.errors?.join("; "));

    const doc = generated.doc;
    assertOk(doc.metadata.title === "Clinical nutrition pathway optimization study", "generated title mismatch");
    assertOk(
      doc.children.some((block) => block.type === "section" && block.title === "Study Design"),
      "generated doc missing expected section",
    );
    assertOk(
      doc.children.some((block) => block.type === "reference-list"),
      "generated doc missing expected references",
    );

    const latexResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/export",
      payload: {
        format: "latex",
        doc,
        style: {
          styleProfileId: styleProfiles[0].id,
          bodyFontSizePt: 13,
          lineSpacing: 1.8,
          marginTopMm: 22,
          marginBottomMm: 24,
          marginLeftMm: 26,
          marginRightMm: 20,
        },
      },
    });

    assertOk(latexResponse.statusCode === 200, "latex export status", latexResponse.body);
    const latexText = latexResponse.body;
    assertOk(latexText.includes("\\section{Study Design}"), "latex export missing section");
    assertOk(latexText.includes("\\begin{thebibliography}{99}"), "latex export missing bibliography");
    assertOk(latexText.includes("\\begin{equation*}"), "latex export missing formula");

    const docxResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/export",
      payload: {
        format: "docx",
        doc,
        style: {
          styleProfileId: styleProfiles[0].id,
          bodyFontSizePt: 13,
          lineSpacing: 1.8,
          marginTopMm: 22,
          marginBottomMm: 24,
          marginLeftMm: 26,
          marginRightMm: 20,
        },
      },
    });

    assertOk(docxResponse.statusCode === 200, "docx export status", docxResponse.body);
    const docxBuffer = docxResponse.rawPayload;
    assertOk(Buffer.isBuffer(docxBuffer), "docx export did not return a buffer");
    assertOk(docxBuffer[0] === 0x50 && docxBuffer[1] === 0x4b, "docx export is not a zip/docx buffer");

    const docxImportResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/import",
      payload: {
        fileName: "roundtrip.docx",
        contentBase64: toBase64(docxBuffer),
      },
    });

    assertOk(docxImportResponse.statusCode === 200, "docx import route status", docxImportResponse.body);
    const importedDocx = docxImportResponse.json();
    assertOk(importedDocx.sourceType === "docx", "docx import sourceType mismatch");
    assertOk(importedDocx.rawText.length > 40, "docx import returned too little text");

    const expectedFragments = [
      doc.metadata.title,
      ...collectDocFragments(doc.children),
    ].filter(Boolean);
    const matchedFragment = expectedFragments.find((fragment) => importedDocx.rawText.includes(fragment));
    assertOk(Boolean(matchedFragment), "docx import content mismatch", importedDocx.rawText);

    console.log(
      `PASS: workbench full flow works (blocks=${doc.children.length}, latex=${latexText.length} chars, docx=${docxBuffer.length} bytes, docxImport=${importedDocx.rawText.length} chars)`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
