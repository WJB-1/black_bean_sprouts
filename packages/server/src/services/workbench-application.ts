import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import {
  createEmptyDoc,
  isValidDoc,
  type AbstractBlock,
  type BlockNode,
  type Doc,
  type FigureBlock,
  type FormulaBlock,
  type HeadingBlock,
  type InlineNode,
  type ParagraphBlock,
  type ReferenceItem,
  type ReferenceListBlock,
  type SectionBlock,
  type TableBlock,
  type TableCell,
  type TableRow,
} from "@black-bean-sprouts/doc-schema";
import {
  applyStyleProfileAdjustments,
  DocxRenderer,
  getBuiltInStyleProfile,
  LatexRenderer,
  listBuiltInStyleProfiles,
} from "@black-bean-sprouts/doc-engine";
import { runOpenClawTextPrompt } from "../integration/openclaw-runtime.js";
import { runSiliconFlowTextPrompt } from "../integration/siliconflow-runtime.js";

type StructuredDraft = {
  title?: string;
  subtitle?: string;
  institution?: string;
  keywords?: unknown;
  authors?: unknown;
  blocks?: unknown;
  children?: unknown;
};

export type WorkbenchGenerateResult = {
  readonly doc: Doc;
  readonly modelOutput?: string;
  readonly degraded: boolean;
  readonly warning?: string;
};

export type WorkbenchExportResult = {
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly contentType: string;
};

export type WorkbenchStyleProfileSummary = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaults: {
    readonly bodyFontSizePt: number;
    readonly lineSpacing: number;
    readonly marginTopMm: number;
    readonly marginBottomMm: number;
    readonly marginLeftMm: number;
    readonly marginRightMm: number;
  };
};

export type WorkbenchExportStyleSettings = {
  readonly styleProfileId?: string;
  readonly bodyFontSizePt?: number;
  readonly lineSpacing?: number;
  readonly marginTopMm?: number;
  readonly marginBottomMm?: number;
  readonly marginLeftMm?: number;
  readonly marginRightMm?: number;
};

export type WorkbenchImportResult = {
  readonly rawText: string;
  readonly title?: string;
  readonly sourceType: "docx" | "text";
};

export type WorkbenchApplicationService = {
  importSource(params: { fileName: string; contentBase64: string }): Promise<WorkbenchImportResult>;
  generateDocument(params: { rawText: string; title?: string }): Promise<WorkbenchGenerateResult>;
  exportDocument(params: {
    doc: Doc;
    format: "docx" | "latex";
    style?: WorkbenchExportStyleSettings;
  }): Promise<WorkbenchExportResult>;
  listStyleProfiles(): Promise<readonly WorkbenchStyleProfileSummary[]>;
};

export type WorkbenchPromptRunner = (params: {
  message: string;
  sessionKey: string;
}) => Promise<string>;

export type WorkbenchApplicationDeps = {
  readonly runPrompt?: WorkbenchPromptRunner;
};

export function createWorkbenchApplicationService(
  deps: WorkbenchApplicationDeps = {},
): WorkbenchApplicationService {
  const runPrompt = deps.runPrompt ?? resolveWorkbenchPromptRunner();

  return {
    async listStyleProfiles() {
      return listBuiltInStyleProfiles().map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        defaults: {
          bodyFontSizePt: item.profile.fonts.defaultSize / 2,
          lineSpacing: item.profile.fonts.lineSpacing,
          marginTopMm: item.profile.pageLayout.marginTop,
          marginBottomMm: item.profile.pageLayout.marginBottom,
          marginLeftMm: item.profile.pageLayout.marginLeft,
          marginRightMm: item.profile.pageLayout.marginRight,
        },
      }));
    },

    async importSource(params) {
      const fileName = params.fileName.trim();
      if (!fileName) {
        throw new Error("fileName is required");
      }
      if (!params.contentBase64.trim()) {
        throw new Error("contentBase64 is required");
      }

      const buffer = Buffer.from(params.contentBase64, "base64");
      const fileExtension = getLowercaseFileExtension(fileName);

      if (fileExtension === ".docx") {
        return importDocxSource({
          fileName,
          buffer,
        });
      }

      return {
        rawText: normalizeImportedText(buffer.toString("utf8")),
        title: deriveTitleFromFileName(fileName),
        sourceType: "text",
      };
    },

    async generateDocument(params) {
      const rawText = params.rawText.trim();
      const fallbackTitle = normalizeOptionalString(params.title) ?? deriveTitleFromRawText(rawText);
      const sessionKey = `workbench:generate:${randomUUID()}`;

      if (!rawText) {
        throw new Error("rawText is required");
      }

      const prompt = buildStructuringPrompt({
        title: fallbackTitle,
        rawText,
      });

      try {
        const modelOutput = await runPrompt({
          message: prompt,
          sessionKey,
        });
        const draft = await parseStructuredDraftWithRecovery({
          modelOutput,
          fallbackTitle,
          runPrompt,
          sessionKey,
        });
        const doc = convertDraftToDoc(draft, fallbackTitle);
        const validation = isValidDoc(doc);

        if (!validation.ok) {
          return {
            doc: buildFallbackDoc(rawText, fallbackTitle),
            modelOutput,
            degraded: true,
            warning: `模型返回的结构不合法，已回退为段落导入：${validation.errors.join("; ")}`, 
          };
        }

        return {
          doc,
          modelOutput,
          degraded: false,
        };
      } catch (error) {
        return {
          doc: buildFallbackDoc(rawText, fallbackTitle),
          modelOutput: error instanceof Error ? error.message : String(error),
          degraded: true,
          warning:
            error instanceof Error
              ? `AI 结构化失败，已回退为段落导入：${error.message}`
              : "AI 结构化失败，已回退为段落导入。",
        };
      }
    },

    async exportDocument(params) {
      const styleProfile = resolveWorkbenchExportStyle(params.style);

      if (params.format === "docx") {
        const renderer = new DocxRenderer(styleProfile);
        const result = await renderer.render(params.doc);
        return {
          buffer: result.buffer,
          fileName: `${sanitizeDownloadFileName(params.doc.metadata.title || "document")}.docx`,
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
      }

      if (params.format === "latex") {
        const renderer = new LatexRenderer(styleProfile);
        const result = await renderer.render(params.doc);
        return {
          buffer: result.buffer,
          fileName: `${sanitizeDownloadFileName(params.doc.metadata.title || "document")}.tex`,
          contentType: "application/x-tex; charset=utf-8",
        };
      }

      throw new Error(`Unsupported export format: ${String(params.format)}`);
    },
  };
}

function resolveWorkbenchPromptRunner(): WorkbenchPromptRunner {
  if (process.env.WORKBENCH_PROMPT_PROVIDER === "openclaw") {
    return runOpenClawTextPrompt;
  }
  if (process.env.WORKBENCH_PROMPT_PROVIDER === "siliconflow-direct") {
    return runSiliconFlowTextPrompt;
  }
  if (process.env.SILICONFLOW_API_KEY?.trim()) {
    return runSiliconFlowTextPrompt;
  }
  return runOpenClawTextPrompt;
}

function buildStructuringPrompt(params: { title: string; rawText: string }): string {
  return [
    "You are a research-document structuring assistant.",
    "Return exactly one valid JSON object and nothing else.",
    "Do not return markdown, prose, comments, or code fences.",
    "The top-level JSON value must be an object with a `blocks` array.",
    "Never return a bare block object. Never return a bare array.",
    "Use this schema:",
    "{",
    '  "title": "Document title",',
    '  "subtitle": "Optional subtitle",',
    '  "institution": "Optional institution",',
    '  "keywords": ["keyword 1", "keyword 2"],',
    '  "authors": [{"name": "Author name", "affiliation": "Optional affiliation"}],',
    '  "blocks": [',
    '    {"type":"abstract","paragraphs":["Abstract paragraph 1","Abstract paragraph 2"]},',
    '    {"type":"section","title":"Section title","children":[...blocks...]},',
    '    {"type":"heading","level":2,"text":"Heading text"},',
    '    {"type":"paragraph","text":"Body paragraph"},',
    '    {"type":"formula","latex":"E=mc^2","caption":"Optional caption"},',
    '    {"type":"table","header":["Col 1","Col 2"],"rows":[["a","b"]],"caption":"Optional caption"},',
    '    {"type":"figure","src":"image.png","alt":"Figure alt text","caption":"Optional caption"},',
    '    {"type":"reference-list","items":[{"key":"ref1","authors":["A"],"title":"Reference title","year":2024,"source":"Journal or publisher","doi":"Optional DOI","url":"Optional URL"}]}',
    "  ]",
    "}",
    "Valid minimal example:",
    '{"title":"Fallback title","subtitle":"","institution":"","keywords":[],"authors":[],"blocks":[{"type":"paragraph","text":"Body paragraph"}]}',
    "Rules:",
    "1. Use only the block types listed above.",
    "2. Do not output id, version, marks, or inline children.",
    "3. Keep the structure faithful to the source draft.",
    "4. If the structure is unclear, prefer paragraph blocks instead of inventing sections.",
    "5. Do not invent authors, references, figures, years, or institutions that are not present.",
    "6. Keep formulas as LaTeX strings.",
    `7. If the draft has no reliable title, use this fallback title: ${params.title}`,
    "8. If information is missing, use empty strings or empty arrays instead of malformed JSON.",
    "9. If you only identify one block, still wrap it inside the top-level `blocks` array.",
    "Raw draft starts:",
    params.rawText,
    "Raw draft ends.",
  ].join("\n");
}
function parseStructuredDraft(modelOutput: string): StructuredDraft {
  const trimmed = modelOutput.trim();
  const candidates = collectJsonCandidates(trimmed);

  if (!candidates.length) {
    throw new Error("模型没有返回可解析的 JSON。");
  }

  let lastError: Error | undefined;
  for (const candidate of candidates) {
    const normalizedCandidates = Array.from(
      new Set([candidate, sanitizeLooseJsonCandidate(candidate)].filter((value) => value.length > 0)),
    );

    for (const normalizedCandidate of normalizedCandidates) {
      try {
        const parsed = JSON.parse(normalizedCandidate) as unknown;
        return normalizeStructuredDraftPayload(parsed);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw new Error(lastError?.message ?? "模型返回的 JSON 无法解析。");
}
async function parseStructuredDraftWithRecovery(params: {
  modelOutput: string;
  fallbackTitle: string;
  runPrompt: WorkbenchPromptRunner;
  sessionKey: string;
}): Promise<StructuredDraft> {
  try {
    return parseStructuredDraft(params.modelOutput);
  } catch (error) {
    const repairedOutput = await params.runPrompt({
      message: buildJsonRepairPrompt({
        fallbackTitle: params.fallbackTitle,
        modelOutput: params.modelOutput,
      }),
      sessionKey: `${params.sessionKey}:repair`,
    });

    try {
      return parseStructuredDraft(repairedOutput);
    } catch (repairError) {
      const firstMessage = error instanceof Error ? error.message : String(error);
      const repairMessage = repairError instanceof Error ? repairError.message : String(repairError);
      throw new Error(`首次解析失败：${firstMessage}; 修复后仍失败：${repairMessage}`);
    }
  }
}
function collectJsonCandidates(value: string): string[] {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const extractedValues = extractBalancedJsonValues(trimmed);
  return Array.from(
    new Set(
      [fencedMatch?.[1]?.trim(), ...extractedValues, trimmed]
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  );
}
function sanitizeLooseJsonCandidate(value: string): string {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function buildJsonRepairPrompt(params: {
  fallbackTitle: string;
  modelOutput: string;
}): string {
  return [
    "You repair malformed JSON for a research-document structuring pipeline.",
    "Return exactly one valid JSON object and nothing else.",
    "Allowed top-level keys: title, subtitle, institution, keywords, authors, blocks.",
    "Allowed block types: abstract, section, heading, paragraph, formula, table, figure, reference-list.",
    "authors must be an array. blocks must be an array.",
    "If the malformed content is a bare block object or a bare array, wrap it into a top-level object with a `blocks` array.",
    "Fix syntax issues such as trailing commas, stray prose, code fences, comments, broken quotes, and malformed arrays.",
    "Delete any text that is not valid JSON. Do not invent facts that are not present in the draft.",
    `Fallback title: ${params.fallbackTitle}`,
    '{"title":"Fallback title","subtitle":"","institution":"","keywords":[],"authors":[],"blocks":[{"type":"paragraph","text":"Body paragraph"}]}',
    "Malformed content starts:",
    params.modelOutput,
    "Malformed content ends.",
  ].join("\n");
}
function extractBalancedJsonValues(value: string): string[] {
  const results: string[] = [];
  let startIndex = -1;
  let depth = 0;
  let closeChar = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      if (depth === 0) {
        startIndex = index;
        closeChar = char === "{" ? "}" : "]";
      }
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && startIndex >= 0) {
          results.push(value.slice(startIndex, index + 1));
          startIndex = -1;
          closeChar = "";
        }
      }
    }
  }

  return results;
}

function normalizeStructuredDraftPayload(value: unknown): StructuredDraft {
  if (Array.isArray(value)) {
    return { blocks: value };
  }

  if (!value || typeof value !== "object") {
    throw new Error("模型返回的顶层不是对象。");
  }

  const draft = value as StructuredDraft & Record<string, unknown>;

  if (Array.isArray(draft.blocks) || Array.isArray(draft.children)) {
    return draft;
  }

  if (looksLikeLooseBlock(draft)) {
    return {
      ...(typeof draft.title === "string" ? { title: draft.title } : {}),
      blocks: [draft],
    };
  }

  if (typeof draft.abstract === "string" && draft.abstract.trim()) {
    return {
      ...(typeof draft.title === "string" ? { title: draft.title } : {}),
      blocks: [{ type: "abstract", paragraphs: [draft.abstract] }],
    };
  }

  if (typeof draft.content === "string" && draft.content.trim()) {
    return {
      ...(typeof draft.title === "string" ? { title: draft.title } : {}),
      blocks: [{ type: "paragraph", text: draft.content }],
    };
  }

  return draft;
}

function looksLikeLooseBlock(value: Record<string, unknown>): boolean {
  const type = typeof value.type === "string" ? value.type : "";
  return [
    "abstract",
    "section",
    "heading",
    "paragraph",
    "formula",
    "table",
    "figure",
    "reference-list",
  ].includes(type);
}
function convertDraftToDoc(draft: StructuredDraft, fallbackTitle: string): Doc {
  const idFactory = createIdFactory();
  const title =
    normalizeOptionalString(draft.title) ?? normalizeOptionalString(fallbackTitle) ?? "未命名文档";
  const blocks = Array.isArray(draft.blocks)
    ? draft.blocks
    : Array.isArray(draft.children)
      ? draft.children
      : [];

  return {
    version: 0,
    metadata: {
      title,
      ...(normalizeOptionalString(draft.subtitle) ? { subtitle: normalizeOptionalString(draft.subtitle) } : {}),
      ...(normalizeOptionalString(draft.institution)
        ? { institution: normalizeOptionalString(draft.institution) }
        : {}),
      ...resolveKeywords(draft.keywords),
      ...resolveAuthors(draft.authors),
    },
    children: blocks.map((block) => toBlockNode(block, idFactory)).filter(isDefined),
  };
}

function resolveKeywords(value: unknown): Pick<Doc["metadata"], "keywords"> | Record<string, never> {
  if (!Array.isArray(value)) {
    return {};
  }
  const keywords = value
    .map((item) => (typeof item === "string" ? normalizeOptionalString(item) : undefined))
    .filter((item): item is string => Boolean(item));
  return keywords.length ? { keywords } : {};
}

function resolveAuthors(value: unknown): Pick<Doc["metadata"], "authors"> | Record<string, never> {
  if (!Array.isArray(value)) {
    return {};
  }
  const authors = value
    .map((item) => {
      if (typeof item === "string") {
        const name = normalizeOptionalString(item);
        return name ? { name } : undefined;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return undefined;
      }
      const name = normalizeOptionalString(readRecordString(item, "name"));
      const affiliation = normalizeOptionalString(readRecordString(item, "affiliation"));
      if (!name) {
        return undefined;
      }
      return affiliation ? { name, affiliation } : { name };
    })
    .filter(
      (
        item,
      ): item is {
        readonly name: string;
        readonly affiliation?: string;
      } => Boolean(item),
    );
  return authors.length ? { authors } : {};
}

function toBlockNode(
  value: unknown,
  createId: (prefix: string) => string,
): BlockNode | undefined {
  if (typeof value === "string") {
    return makeParagraph(value, createId);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const type = normalizeOptionalString(readRecordString(value, "type"));
  switch (type) {
    case "paragraph":
      return makeParagraph(readPreferredText(value), createId);
    case "heading":
      return makeHeading(value, createId);
    case "section":
      return makeSection(value, createId);
    case "abstract":
      return makeAbstract(value, createId);
    case "formula":
      return makeFormula(value, createId);
    case "figure":
      return makeFigure(value, createId);
    case "table":
      return makeTable(value, createId);
    case "reference-list":
      return makeReferenceList(value, createId);
    default:
      return makeParagraph(readPreferredText(value), createId);
  }
}

function makeParagraph(
  text: string | undefined,
  createId: (prefix: string) => string,
): ParagraphBlock | undefined {
  const normalized = normalizeOptionalString(text);
  if (!normalized) {
    return undefined;
  }
  return {
    type: "paragraph",
    id: createId("p"),
    children: textToInlineNodes(normalized),
  };
}

function makeHeading(
  value: object,
  createId: (prefix: string) => string,
): HeadingBlock | undefined {
  const text = normalizeOptionalString(readPreferredText(value));
  if (!text) {
    return undefined;
  }
  const level = clampHeadingLevel(readRecordNumber(value, "level"));
  return {
    type: "heading",
    id: createId("h"),
    level,
    children: textToInlineNodes(text),
  };
}

function makeSection(
  value: object,
  createId: (prefix: string) => string,
): SectionBlock | undefined {
  const title =
    normalizeOptionalString(readRecordString(value, "title")) ??
    normalizeOptionalString(readPreferredText(value));
  if (!title) {
    return undefined;
  }
  const children = readRecordArray(value, "children")
    .map((child) => toBlockNode(child, createId))
    .filter((child): child is BlockNode => Boolean(child));
  return {
    type: "section",
    id: createId("sec"),
    title,
    children,
  };
}

function makeAbstract(
  value: object,
  createId: (prefix: string) => string,
): AbstractBlock | undefined {
  const paragraphs = readRecordArray(value, "paragraphs")
    .map((item) => (typeof item === "string" ? normalizeOptionalString(item) : undefined))
    .filter((item): item is string => Boolean(item))
    .map((item) => ({
      type: "paragraph" as const,
      id: createId("abs-p"),
      children: textToInlineNodes(item),
    }));

  if (!paragraphs.length) {
    const fallbackText = normalizeOptionalString(readPreferredText(value));
    if (!fallbackText) {
      return undefined;
    }
    paragraphs.push({
      type: "paragraph",
      id: createId("abs-p"),
      children: textToInlineNodes(fallbackText),
    });
  }

  return {
    type: "abstract",
    id: createId("abs"),
    children: paragraphs,
  };
}

function makeFormula(
  value: object,
  createId: (prefix: string) => string,
): FormulaBlock | undefined {
  const latex = normalizeOptionalString(readRecordString(value, "latex"));
  if (!latex) {
    return undefined;
  }
  const caption = normalizeOptionalString(readRecordString(value, "caption"));
  return {
    type: "formula",
    id: createId("fm"),
    latex,
    ...(caption ? { caption: textToInlineNodes(caption) } : {}),
  };
}

function makeFigure(
  value: object,
  createId: (prefix: string) => string,
): FigureBlock | undefined {
  const src = normalizeOptionalString(readRecordString(value, "src"));
  if (!src) {
    return undefined;
  }
  const alt = normalizeOptionalString(readRecordString(value, "alt"));
  const caption = normalizeOptionalString(readRecordString(value, "caption"));
  const width = readRecordNumber(value, "width");
  const height = readRecordNumber(value, "height");
  return {
    type: "figure",
    id: createId("fig"),
    src,
    ...(alt ? { alt } : {}),
    ...(caption ? { caption: textToInlineNodes(caption) } : {}),
    ...(typeof width === "number" && Number.isFinite(width) ? { width } : {}),
    ...(typeof height === "number" && Number.isFinite(height) ? { height } : {}),
  };
}

function makeTable(
  value: object,
  createId: (prefix: string) => string,
): TableBlock | undefined {
  const header = readRecordArray(value, "header")
    .map((item) => (typeof item === "string" ? normalizeOptionalString(item) : undefined))
    .filter((item): item is string => Boolean(item));
  const rows = readRecordArray(value, "rows")
    .flatMap((row) => {
      if (!Array.isArray(row)) {
        return [];
      }
      const cells = row
        .map((cell) => (typeof cell === "string" ? normalizeOptionalString(cell) : undefined))
        .filter(isDefined)
        .map((cell) => makeTableCell(cell, createId));
      return cells.length
        ? [{
            id: createId("tr"),
            cells,
          } satisfies TableRow]
        : [];
    });

  if (!header.length && !rows.length) {
    return undefined;
  }

  const caption = normalizeOptionalString(readRecordString(value, "caption"));
  return {
    type: "table",
    id: createId("tbl"),
    ...(header.length
      ? {
          headerRow: {
            id: createId("trh"),
            cells: header.map((cell) => makeTableCell(cell, createId)),
          },
        }
      : {}),
    rows,
    ...(caption ? { caption: textToInlineNodes(caption) } : {}),
  };
}

function makeTableCell(
  text: string,
  createId: (prefix: string) => string,
): TableCell {
  return {
    id: createId("tc"),
    children: [
      {
        type: "paragraph",
        id: createId("tcp"),
        children: textToInlineNodes(text),
      },
    ],
  };
}

function makeReferenceList(
  value: object,
  createId: (prefix: string) => string,
): ReferenceListBlock | undefined {
  const items = readRecordArray(value, "items")
    .map((item, index) => makeReferenceItem(item, index, createId))
    .filter(isDefined);
  if (!items.length) {
    return undefined;
  }
  return {
    type: "reference-list",
    id: createId("refs"),
    items,
  };
}

function makeReferenceItem(
  value: unknown,
  index: number,
  createId: (prefix: string) => string,
): ReferenceItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const title = normalizeOptionalString(readRecordString(value, "title"));
  const source = normalizeOptionalString(readRecordString(value, "source"));
  if (!title || !source) {
    return undefined;
  }
  const key =
    normalizeOptionalString(readRecordString(value, "key")) ??
    `ref-${index + 1}`;
  const authors = readRecordArray(value, "authors")
    .map((item) => (typeof item === "string" ? normalizeOptionalString(item) : undefined))
    .filter((item): item is string => Boolean(item));
  const year = readRecordNumber(value, "year");
  const doi = normalizeOptionalString(readRecordString(value, "doi"));
  const url = normalizeOptionalString(readRecordString(value, "url"));
  return {
    id: createId(`ref-item-${index + 1}`),
    key,
    authors,
    title,
    ...(typeof year === "number" && Number.isFinite(year) ? { year: Math.trunc(year) } : {}),
    source,
    ...(doi ? { doi } : {}),
    ...(url ? { url } : {}),
  };
}

function buildFallbackDoc(rawText: string, fallbackTitle: string): Doc {
  const idFactory = createIdFactory();
  const paragraphs = splitIntoParagraphs(rawText);
  return {
    ...createEmptyDoc(fallbackTitle),
    children: paragraphs
    .map((paragraph, index) => {
      const heading = parseFallbackHeading(paragraph, idFactory, index);
      if (heading) {
        return heading;
      }
      return makeParagraph(paragraph, idFactory);
    })
    .filter(isDefined),
  };
}

function parseFallbackHeading(
  paragraph: string,
  createId: (prefix: string) => string,
  index: number,
): HeadingBlock | undefined {
  const markdownMatch = paragraph.match(/^(#{1,6})\s+(.+)$/);
  if (markdownMatch?.[2]) {
    const level = clampHeadingLevel(markdownMatch[1]?.length);
    const text = normalizeOptionalString(markdownMatch[2]);
    if (!text) {
      return undefined;
    }
    return {
      type: "heading",
      id: createId(`fh${index}`),
      level,
      children: textToInlineNodes(text),
    };
  }
  return undefined;
}

function splitIntoParagraphs(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

function deriveTitleFromRawText(rawText: string): string {
  const firstLine = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? "未命名文档";
}

function deriveTitleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, "").trim() || "未命名文档";
}

function textToInlineNodes(text: string): readonly InlineNode[] {
  const segments = text.replace(/\r\n/g, "\n").split("\n");
  const inlines: InlineNode[] = [];
  segments.forEach((segment, index) => {
    if (segment.length > 0) {
      inlines.push({ type: "text", text: segment });
    }
    if (index < segments.length - 1) {
      inlines.push({ type: "hardBreak" });
    }
  });
  return inlines;
}

function clampHeadingLevel(value: number | undefined): HeadingBlock["level"] {
  if (!value || !Number.isFinite(value)) {
    return 1;
  }
  const normalized = Math.min(6, Math.max(1, Math.trunc(value)));
  return normalized as HeadingBlock["level"];
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readRecordString(value: object, key: string): string | undefined {
  const record = value as Record<string, unknown>;
  return typeof record[key] === "string" ? record[key] : undefined;
}

function readRecordNumber(value: object, key: string): number | undefined {
  const record = value as Record<string, unknown>;
  return typeof record[key] === "number" ? record[key] : undefined;
}

function readRecordArray(value: object, key: string): unknown[] {
  const record = value as Record<string, unknown>;
  return Array.isArray(record[key]) ? record[key] : [];
}

function readPreferredText(value: object): string | undefined {
  return (
    readRecordString(value, "text") ??
    readRecordString(value, "content") ??
    readRecordString(value, "title") ??
    readRecordString(value, "value")
  );
}

function createIdFactory(): (prefix: string) => string {
  const used = new Set<string>();
  let seq = 0;
  return (prefix: string) => {
    let candidate = `${prefix}-${seq++}`;
    while (used.has(candidate)) {
      candidate = `${prefix}-${seq++}`;
    }
    used.add(candidate);
    return candidate;
  };
}

async function importDocxSource(params: {
  fileName: string;
  buffer: Buffer;
}): Promise<WorkbenchImportResult> {
  const zip = await JSZip.loadAsync(params.buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("DOCX 缺少 word/document.xml，无法导入。");
  }

  const paragraphs = extractParagraphsFromWordXml(documentXml);
  const title =
    extractDocxTitle(await zip.file("docProps/core.xml")?.async("string")) ??
    deriveTitleFromFileName(params.fileName);
  const rawText = normalizeImportedText(paragraphs.join("\n\n"));

  if (!rawText) {
    throw new Error("DOCX 中没有可提取的正文文本。");
  }

  return {
    rawText,
    title,
    sourceType: "docx",
  };
}

function extractParagraphsFromWordXml(xml: string): string[] {
  const paragraphs: string[] = [];
  const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const text = extractTextFromWordFragment(match[0]);
    const normalized = normalizeImportedText(text);
    if (normalized) {
      paragraphs.push(normalized);
    }
  }
  return paragraphs;
}

function extractTextFromWordFragment(fragment: string): string {
  const normalizedFragment = fragment
    .replace(/<w:tab\b[^/]*\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^/]*\/>/g, "\n");
  const pieces: string[] = [];
  const textRegex = /<w:(?:t|instrText)\b[^>]*>([\s\S]*?)<\/w:(?:t|instrText)>/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(normalizedFragment)) !== null) {
    pieces.push(decodeXmlEntities(match[1] ?? ""));
  }
  return pieces.join("");
}

function extractDocxTitle(xml: string | undefined): string | undefined {
  if (!xml) {
    return undefined;
  }
  const titleMatch = xml.match(/<dc:title>([\s\S]*?)<\/dc:title>/i);
  return normalizeOptionalString(titleMatch?.[1] ? decodeXmlEntities(titleMatch[1]) : undefined);
}

function normalizeImportedText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getLowercaseFileExtension(fileName: string): string {
  const match = fileName.match(/\.[^.]+$/u);
  return match?.[0]?.toLowerCase() ?? "";
}

function resolveWorkbenchExportStyle(style: WorkbenchExportStyleSettings | undefined) {
  const selected = getBuiltInStyleProfile(style?.styleProfileId);
  if (!selected) {
    throw new Error(`Unknown style profile: ${style?.styleProfileId}`);
  }

  return applyStyleProfileAdjustments(selected.profile, {
    ...(style?.bodyFontSizePt !== undefined
      ? { bodyFontSize: clampNumber(style.bodyFontSizePt, 8, 24) * 2 }
      : {}),
    ...(style?.lineSpacing !== undefined
      ? { lineSpacing: clampNumber(style.lineSpacing, 1, 3) }
      : {}),
    ...(style?.marginTopMm !== undefined
      ? { marginTop: clampNumber(style.marginTopMm, 5, 60) }
      : {}),
    ...(style?.marginBottomMm !== undefined
      ? { marginBottom: clampNumber(style.marginBottomMm, 5, 60) }
      : {}),
    ...(style?.marginLeftMm !== undefined
      ? { marginLeft: clampNumber(style.marginLeftMm, 5, 60) }
      : {}),
    ...(style?.marginRightMm !== undefined
      ? { marginRight: clampNumber(style.marginRightMm, 5, 60) }
      : {}),
  });
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function sanitizeDownloadFileName(value: string): string {
  const normalized = value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "document";
}

function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}


