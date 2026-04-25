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
const originalProcessExit = process.exit.bind(process);

process.exit = ((code = 0) => {
  const error = new Error(`process.exit(${code})`);
  console.error("PROCESS_EXIT", code, error.stack);
  throw error;
});
process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED_REJECTION", error);
});
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT_EXCEPTION", error);
});

const LIVE_RAW_TEXT = [
  "Workbench Live Smoke 2026-04-25",
  "",
  "Abstract",
  "Goal: turn a rough clinical draft into a structured paper outline.",
  "Methods: summarize the purpose, design, results, and conclusion from the source text.",
  "Results: the output should contain an abstract, at least one section, and reusable export content.",
  "Conclusion: this verifies the OpenClaw plus SiliconFlow live path.",
  "",
  "1 Background",
  "Clinical nutrition support affects recovery quality and length of stay.",
  "",
  "2 Methods",
  "The draft covers a retrospective comparison with 86 inpatients.",
  "",
  "3 Findings",
  "Enhanced nutrition support improves albumin and shortens stay.",
].join("\n");

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
  console.log("smoke:workbench-live - Testing live workbench AI flow...");

  if (!process.env.SILICONFLOW_API_KEY?.trim()) {
    throw new Error("SILICONFLOW_API_KEY is required for live smoke.");
  }

  const promptProvider =
    process.env.WORKBENCH_PROMPT_PROVIDER ||
    (process.env.SILICONFLOW_API_KEY?.trim() ? "siliconflow-direct(auto)" : "openclaw(auto)");
  console.log(`smoke:workbench-live - PromptProvider=${promptProvider}`);

  if (promptProvider.includes("openclaw")) {
    console.log(
      `smoke:workbench-live - Config=${process.env.OPENCLAW_CONFIG_PATH || path.join(repoRoot, ".openclaw-runtime", "openclaw.json")}`,
    );
    console.log(
      `smoke:workbench-live - Workspace=${process.env.OPENCLAW_WORKSPACE_DIR || repoRoot}`,
    );
    console.log(
      `smoke:workbench-live - Project=${process.env.OPENCLAW_PROJECT_PATH || path.resolve(repoRoot, "..", "reference_projects", "openclaw")}`,
    );
  }

  const { createWorkbenchRoutes, createWorkbenchApplicationService, isValidDoc } = await loadRuntime();
  const app = Fastify({ logger: false });
  const workbenchService = createWorkbenchApplicationService();

  await app.register(createWorkbenchRoutes({ workbenchService }), { prefix: "/api/workbench" });

  try {
    console.log("smoke:workbench-live - Step 1/4 import text");
    const textImportResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/import",
      payload: {
        fileName: "live-smoke.txt",
        contentBase64: toBase64(LIVE_RAW_TEXT),
      },
    });

    assertOk(textImportResponse.statusCode === 200, "live text import status", textImportResponse.body);
    const importedText = textImportResponse.json();
    assertOk(importedText.rawText.includes("OpenClaw plus SiliconFlow"), "live text import content mismatch");

    console.log("smoke:workbench-live - Step 2/4 generate document");
    const generateResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/generate",
      payload: {
        title: "Workbench Live Smoke 2026-04-25",
        rawText: importedText.rawText,
      },
    });

    assertOk(generateResponse.statusCode === 200, "live generate status", generateResponse.body);
    const generated = generateResponse.json();
    assertOk(!generated.degraded, "live generate degraded", generated.warning ?? generated.modelOutput);
    assertOk(typeof generated.modelOutput === "string" && generated.modelOutput.trim().length > 10, "live model output missing");

    const validation = isValidDoc(generated.doc);
    assertOk(validation.ok, "live generated doc invalid", validation.errors?.join("; "));

    const doc = generated.doc;
    assertOk((doc.children?.length ?? 0) > 0, "live generated doc is empty");
    assertOk(
      doc.children.some((block) => block.type === "section" || block.type === "heading"),
      "live generated doc missing section or heading",
    );

    console.log("smoke:workbench-live - Step 3/4 export artifacts");
    const latexResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/export",
      payload: {
        format: "latex",
        doc,
      },
    });

    assertOk(latexResponse.statusCode === 200, "live latex export status", latexResponse.body);
    assertOk(latexResponse.body.includes("\\begin{document}"), "live latex export missing document body");

    const docxResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/export",
      payload: {
        format: "docx",
        doc,
      },
    });

    assertOk(docxResponse.statusCode === 200, "live docx export status", docxResponse.body);
    const docxBuffer = docxResponse.rawPayload;
    assertOk(Buffer.isBuffer(docxBuffer), "live docx export did not return a buffer");
    assertOk(docxBuffer[0] === 0x50 && docxBuffer[1] === 0x4b, "live docx export is not a zip/docx buffer");

    console.log("smoke:workbench-live - Step 4/4 roundtrip import docx");
    const docxImportResponse = await app.inject({
      method: "POST",
      url: "/api/workbench/import",
      payload: {
        fileName: "live-roundtrip.docx",
        contentBase64: toBase64(docxBuffer),
      },
    });

    assertOk(docxImportResponse.statusCode === 200, "live docx import status", docxImportResponse.body);
    const importedDocx = docxImportResponse.json();
    assertOk(importedDocx.sourceType === "docx", "live docx import sourceType mismatch");
    assertOk(importedDocx.rawText.length > 40, "live docx import returned too little text");

    const expectedFragments = [
      doc.metadata?.title,
      ...collectDocFragments(doc.children),
    ].filter(Boolean);
    const matchedFragment = expectedFragments.find((fragment) => importedDocx.rawText.includes(fragment));
    assertOk(Boolean(matchedFragment), "live docx import content mismatch", importedDocx.rawText);

    console.log(
      `PASS: live workbench flow works (title=${doc.metadata?.title || "untitled"}, blocks=${doc.children.length}, latex=${latexResponse.body.length} chars, docx=${docxBuffer.length} bytes, roundtrip=${importedDocx.rawText.length} chars)`,
    );
  } finally {
    await app.close();
    process.exit = originalProcessExit;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
