import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { isValidDoc, type BlockNode, type Doc, type InlineNode } from "@black-bean-sprouts/doc-schema";

export type AgentDocumentWorkspacePaths = {
  readonly workspaceDir: string;
  readonly documentPath: string;
  readonly previewPath: string;
  readonly instructionsPath: string;
};

export type AgentDocumentWorkspaceContext = AgentDocumentWorkspacePaths & {
  readonly documentId: string;
  readonly baselineDoc: Doc;
  readonly baselineJson: string;
  readonly baselineVersion: number;
};

export type AgentDocumentSnapshot = {
  readonly workspaceDir: string;
  readonly documentPath: string;
  readonly previewPath: string;
  readonly instructionsPath: string;
  readonly rawJson: string;
  readonly hash: string;
  readonly doc?: Doc;
  readonly parseError?: string;
  readonly validationErrors?: string[];
  readonly previewMarkdown: string;
  readonly title?: string;
  readonly blockCount?: number;
  readonly sectionCount?: number;
};

export type AgentDocumentPersistResult = {
  readonly persisted: boolean;
  readonly updated: boolean;
  readonly version?: number;
  readonly doc?: Doc;
  readonly snapshot: AgentDocumentSnapshot;
};

type PersistedDocumentRow = {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly content: unknown;
};

const WORKSPACE_ROOT_DIR = ".tmp";
const WORKSPACE_NAMESPACE = "agent-doc-workspaces";
const DOCUMENT_FILE_NAME = "document.json";
const PREVIEW_FILE_NAME = "document.preview.md";
const INSTRUCTIONS_FILE_NAME = "agent-instructions.md";

export function resolveAgentDocumentWorkspacePaths(params: {
  documentId: string;
  sessionKey?: string;
}): AgentDocumentWorkspacePaths {
  const repoRoot = getRepoRoot();
  const sessionSegment = buildSessionSegment(params.sessionKey);
  const workspaceDir = path.join(
    repoRoot,
    WORKSPACE_ROOT_DIR,
    WORKSPACE_NAMESPACE,
    sanitizeSegment(params.documentId),
    sessionSegment,
  );
  return {
    workspaceDir,
    documentPath: path.join(workspaceDir, DOCUMENT_FILE_NAME),
    previewPath: path.join(workspaceDir, PREVIEW_FILE_NAME),
    instructionsPath: path.join(workspaceDir, INSTRUCTIONS_FILE_NAME),
  };
}

export async function prepareAgentDocumentWorkspace(
  prisma: PrismaClient,
  params: {
    documentId: string;
    sessionKey?: string;
  },
): Promise<AgentDocumentWorkspaceContext> {
  const row = await prisma.document.findUnique({
    where: { id: params.documentId },
    select: {
      id: true,
      title: true,
      version: true,
      content: true,
    },
  });
  if (!row) {
    throw new Error(`Document not found: ${params.documentId}`);
  }

  const doc = normalizePersistedDoc(row);
  const paths = resolveAgentDocumentWorkspacePaths(params);
  const baselineJson = JSON.stringify(doc, null, 2);
  await fs.mkdir(paths.workspaceDir, { recursive: true });
  await fs.writeFile(paths.documentPath, baselineJson, "utf8");
  await fs.writeFile(paths.previewPath, buildPreviewMarkdown(doc), "utf8");
  await fs.writeFile(paths.instructionsPath, buildInstructionsMarkdown(), "utf8");

  return {
    ...paths,
    documentId: row.id,
    baselineDoc: doc,
    baselineJson,
    baselineVersion: row.version,
  };
}

export async function writeAgentDocumentWorkspaceDoc(
  context: AgentDocumentWorkspacePaths,
  doc: Doc,
): Promise<void> {
  await fs.mkdir(context.workspaceDir, { recursive: true });
  await fs.writeFile(context.documentPath, JSON.stringify(doc, null, 2), "utf8");
  await fs.writeFile(context.previewPath, buildPreviewMarkdown(doc), "utf8");
}

export async function readAgentDocumentSnapshot(
  context: AgentDocumentWorkspacePaths,
): Promise<AgentDocumentSnapshot> {
  const rawJson = await fs.readFile(context.documentPath, "utf8");
  const hash = createHash("sha256").update(rawJson).digest("hex");
  const existingPreview = await readTextIfExists(context.previewPath);

  let doc: Doc | undefined;
  let parseError: string | undefined;
  let validationErrors: string[] | undefined;
  let previewMarkdown = existingPreview;
  let title: string | undefined;
  let blockCount: number | undefined;
  let sectionCount: number | undefined;

  try {
    const parsed = JSON.parse(rawJson) as Doc;
    const validation = isValidDoc(parsed);
    if (validation.ok) {
      doc = parsed;
      title = parsed.metadata.title;
      blockCount = countBlocks(parsed.children);
      sectionCount = countSections(parsed.children);
      previewMarkdown = buildPreviewMarkdown(parsed);
      await fs.writeFile(context.previewPath, previewMarkdown, "utf8");
    } else {
      validationErrors = [...validation.errors];
    }
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  return {
    workspaceDir: context.workspaceDir,
    documentPath: context.documentPath,
    previewPath: context.previewPath,
    instructionsPath: context.instructionsPath,
    rawJson,
    hash,
    doc,
    parseError,
    validationErrors,
    previewMarkdown,
    title,
    blockCount,
    sectionCount,
  };
}

export async function persistAgentDocumentWorkspace(
  prisma: PrismaClient,
  context: AgentDocumentWorkspaceContext,
): Promise<AgentDocumentPersistResult> {
  const snapshot = await readAgentDocumentSnapshot(context);
  if (!snapshot.doc) {
    const reason = snapshot.parseError ?? snapshot.validationErrors?.join("; ") ?? "unknown error";
    throw new Error(`Agent produced an invalid document AST: ${reason}`);
  }

  const updated = snapshot.hash !== createHash("sha256").update(context.baselineJson).digest("hex");
  if (!updated) {
    return {
      persisted: false,
      updated: false,
      version: context.baselineVersion,
      doc: snapshot.doc,
      snapshot,
    };
  }

  const nextVersion = context.baselineVersion + 1;
  const persistedDoc: Doc = {
    ...snapshot.doc,
    version: nextVersion,
  };

  const updateResult = await prisma.document.updateMany({
    where: {
      id: context.documentId,
      version: context.baselineVersion,
    },
    data: {
      title: persistedDoc.metadata.title,
      content: persistedDoc as unknown as object,
      version: nextVersion,
    },
  });

  if (updateResult.count !== 1) {
    throw new Error("Document changed while the agent was editing it. Reload and try again.");
  }

  await prisma.documentPatchRecord.create({
    data: {
      documentId: context.documentId,
      expectedVersion: context.baselineVersion,
      patches: {
        mode: "agent-rewrite",
        summary: {
          titleBefore: context.baselineDoc.metadata.title,
          titleAfter: persistedDoc.metadata.title,
          blocksBefore: countBlocks(context.baselineDoc.children),
          blocksAfter: countBlocks(persistedDoc.children),
        },
      } as unknown as object,
      source: "agent",
    },
  });

  await fs.writeFile(context.documentPath, JSON.stringify(persistedDoc, null, 2), "utf8");
  await fs.writeFile(context.previewPath, buildPreviewMarkdown(persistedDoc), "utf8");

  return {
    persisted: true,
    updated: true,
    version: nextVersion,
    doc: persistedDoc,
    snapshot: {
      ...snapshot,
      rawJson: JSON.stringify(persistedDoc, null, 2),
      hash: createHash("sha256").update(JSON.stringify(persistedDoc, null, 2)).digest("hex"),
      doc: persistedDoc,
      previewMarkdown: buildPreviewMarkdown(persistedDoc),
      title: persistedDoc.metadata.title,
      blockCount: countBlocks(persistedDoc.children),
      sectionCount: countSections(persistedDoc.children),
    },
  };
}

export function buildAgentDocumentPrompt(params: {
  userMessage: string;
  documentPath?: string;
  previewPath?: string;
  instructionsPath?: string;
}): string {
  const documentPath = params.documentPath ?? DOCUMENT_FILE_NAME;
  const previewPath = params.previewPath ?? PREVIEW_FILE_NAME;
  const instructionsPath = params.instructionsPath ?? INSTRUCTIONS_FILE_NAME;

  return [
    "You are editing a Black Bean Sprouts document inside a constrained workspace.",
    `Source of truth: \`${documentPath}\`.`,
    `Readable preview: \`${previewPath}\`.`,
    `Rules and schema notes: \`${instructionsPath}\`.`,
    "Use the available tools to read the files, repair the document in multiple steps, and keep the final JSON valid.",
    "Only modify the JSON document unless a supporting file must be refreshed.",
    "Before finishing, re-read the JSON and ensure it parses cleanly.",
    "",
    "User request:",
    params.userMessage,
  ].join("\n");
}

function getRepoRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..", "..", "..");
}

function buildSessionSegment(sessionKey?: string): string {
  const normalized = normalizeOptionalString(sessionKey);
  if (!normalized) {
    return "adhoc";
  }
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "doc";
}

function normalizePersistedDoc(row: PersistedDocumentRow): Doc {
  const rawDoc = row.content as Partial<Doc> | undefined;
  const metadata =
    rawDoc?.metadata && typeof rawDoc.metadata === "object" ? rawDoc.metadata : { title: row.title };
  const children = Array.isArray(rawDoc?.children) ? rawDoc.children : [];
  return {
    version: row.version,
    metadata: {
      title: typeof metadata.title === "string" && metadata.title.trim() ? metadata.title : row.title,
      ...(typeof metadata.subtitle === "string" ? { subtitle: metadata.subtitle } : {}),
      ...(typeof metadata.institution === "string" ? { institution: metadata.institution } : {}),
      ...(Array.isArray(metadata.keywords) ? { keywords: metadata.keywords } : {}),
      ...(Array.isArray(metadata.authors) ? { authors: metadata.authors } : {}),
    },
    children,
  };
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function buildInstructionsMarkdown(): string {
  return [
    "# Agent workspace instructions",
    "",
    "- Edit `document.json` as UTF-8 JSON without comments.",
    "- Keep the root shape: `{ version, metadata, children }`.",
    "- `metadata.title` must remain a non-empty string.",
    "- `children` is an array of block nodes.",
    "- Common block types: `paragraph`, `heading`, `section`, `abstract`, `table`, `figure`, `formula`, `reference-list`.",
    "- `paragraph` and `heading` blocks use `children` inline nodes, where plain text is `{ \"type\": \"text\", \"text\": \"...\" }`.",
    "- `section` blocks use `title` plus nested `children` block nodes.",
    "- Finish with valid JSON that can be parsed directly.",
  ].join("\n");
}

function buildPreviewMarkdown(doc: Doc): string {
  const lines: string[] = [`# ${doc.metadata.title}`];
  if (doc.metadata.subtitle) {
    lines.push("", doc.metadata.subtitle);
  }
  if (doc.metadata.keywords?.length) {
    lines.push("", `Keywords: ${doc.metadata.keywords.join(", ")}`);
  }
  if (doc.metadata.authors?.length) {
    lines.push("", `Authors: ${doc.metadata.authors.map((author) => author.name).join(", ")}`);
  }
  lines.push("");
  appendBlocks(lines, doc.children, 2);
  return lines.join("\n").trim() + "\n";
}

function appendBlocks(lines: string[], blocks: readonly BlockNode[], headingDepth: number): void {
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        lines.push(inlineText(block.children), "");
        break;
      case "heading":
        lines.push(`${"#".repeat(Math.min(6, block.level + headingDepth - 1))} ${inlineText(block.children)}`, "");
        break;
      case "section":
        lines.push(`${"#".repeat(Math.min(6, headingDepth))} ${block.title}`, "");
        appendBlocks(lines, block.children, Math.min(6, headingDepth + 1));
        break;
      case "abstract":
        lines.push(`${"#".repeat(Math.min(6, headingDepth))} Abstract`, "");
        for (const paragraph of block.children) {
          lines.push(inlineText(paragraph.children), "");
        }
        break;
      case "formula":
        lines.push("```latex", block.latex, "```", "");
        break;
      case "table":
        lines.push(`Table: ${tableColumnCount(block)} columns x ${block.rows.length} rows`, "");
        break;
      case "figure":
        lines.push(`Figure: ${block.alt ?? block.src}`, "");
        break;
      case "reference-list":
        lines.push(`${"#".repeat(Math.min(6, headingDepth))} References`, "");
        for (const item of block.items) {
          lines.push(`- ${item.key}: ${item.title}`);
        }
        lines.push("");
        break;
    }
  }
}

function inlineText(children: readonly InlineNode[]): string {
  const text = children
    .map((child) => {
      switch (child.type) {
        case "text":
          return child.text;
        case "formula-inline":
          return child.latex;
        case "hardBreak":
          return " / ";
        case "citation":
          return child.text ?? `[${child.refId}]`;
        case "xref":
          return child.label ?? `[${child.targetId}]`;
        default:
          return "";
      }
    })
    .join("")
    .trim();
  return text || "(empty paragraph)";
}

function tableColumnCount(block: Extract<BlockNode, { type: "table" }>): number {
  return Math.max(0, block.headerRow?.cells.length ?? 0, ...block.rows.map((row) => row.cells.length));
}

function countBlocks(blocks: readonly BlockNode[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === "section") {
      return total + 1 + countBlocks(block.children);
    }
    return total + 1;
  }, 0);
}

function countSections(blocks: readonly BlockNode[]): number {
  return blocks.reduce((total, block) => {
    if (block.type !== "section") {
      return total;
    }
    return total + 1 + countSections(block.children);
  }, 0);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
