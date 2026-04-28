import { randomUUID } from "node:crypto";
import { isValidDoc, type BlockNode, type Doc } from "@black-bean-sprouts/doc-schema";
import { runOpenClawTextPrompt } from "../integration/openclaw-runtime.js";
import { runSiliconFlowTextPrompt } from "../integration/siliconflow-runtime.js";
import {
  readAgentDocumentSnapshot,
  writeAgentDocumentWorkspaceDoc,
  type AgentDocumentSnapshot,
  type AgentDocumentWorkspaceContext,
} from "./agent-document-workspace.js";

type AgentAutonomyEvent = {
  readonly runId: string;
  readonly seq: number;
  readonly stream: string;
  readonly ts: number;
  readonly data: Record<string, unknown>;
  readonly sessionKey?: string;
};

type AgentAutonomyRunResult = {
  readonly reply: string;
  readonly events: AgentAutonomyEvent[];
  readonly finalSnapshot: AgentDocumentSnapshot;
};

type ParseDocResult = {
  readonly doc: Doc;
  readonly note: string;
};

type PromptResult = {
  readonly text: string;
  readonly provider: "openclaw" | "siliconflow-direct";
  readonly fallbackReason?: string;
};

export async function runAutonomousDocumentRepair(params: {
  message: string;
  documentContext: AgentDocumentWorkspaceContext;
  sessionKey?: string;
  onEvent?: (event: AgentAutonomyEvent) => Promise<void> | void;
  onSnapshot?: (snapshot: AgentDocumentSnapshot) => Promise<void> | void;
}): Promise<AgentAutonomyRunResult> {
  const runId = `bbs-doc-auto-${randomUUID()}`;
  const sessionKey = params.sessionKey?.trim() || `bbs-doc-auto-${randomUUID()}`;
  const events: AgentAutonomyEvent[] = [];
  let seq = 0;

  const emit = async (stream: string, data: Record<string, unknown>) => {
    const event: AgentAutonomyEvent = {
      runId,
      seq: seq++,
      stream,
      ts: Date.now(),
      data,
      sessionKey,
    };
    events.push(event);
    await params.onEvent?.(event);
  };

  const initialSnapshot = await readAgentDocumentSnapshot(params.documentContext);
  await emit("lifecycle", { phase: "start", mode: "document-autonomy" });
  await emit("plan", {
    phase: "update",
    title: "Pass 1",
    explanation: "Generate a revised document JSON from the current draft and the user request.",
    steps: ["rewrite current document", "validate JSON", "emit snapshot"],
    source: "document-autonomy",
  });

  const rewriteOutput = await runDocumentPrompt({
    message: buildRewritePrompt({
      userMessage: params.message,
      currentDocumentJson: initialSnapshot.rawJson,
      currentPreview: initialSnapshot.previewMarkdown,
    }),
    sessionKey: `${sessionKey}:rewrite`,
  });
  if (rewriteOutput.fallbackReason) {
    await emit("thinking", {
      text: `rewrite pass fell back to ${rewriteOutput.provider}: ${rewriteOutput.fallbackReason}`,
    });
  }

  const rewriteResult = await parseDocWithRecovery({
    modelOutput: rewriteOutput.text,
    fallbackTitle: initialSnapshot.title ?? params.documentContext.baselineDoc.metadata.title,
    sessionKey: `${sessionKey}:rewrite`,
  });

  await writeAgentDocumentWorkspaceDoc(params.documentContext, rewriteResult.doc);
  await emit("tool", {
    phase: "end",
    toolName: "rewrite_document",
    turn: 1,
    note: rewriteResult.note,
  });

  const rewriteSnapshot = await readAgentDocumentSnapshot(params.documentContext);
  await params.onSnapshot?.(rewriteSnapshot);

  await emit("plan", {
    phase: "update",
    title: "Pass 2",
    explanation: "Review the updated document against the user request and either approve it or return a corrected JSON.",
    steps: ["review current document", "optionally apply corrections", "finalize reply"],
    source: "document-autonomy",
  });

  const reviewOutput = await runDocumentPrompt({
    message: buildReviewPrompt({
      userMessage: params.message,
      currentDocumentJson: rewriteSnapshot.rawJson,
      currentPreview: rewriteSnapshot.previewMarkdown,
    }),
    sessionKey: `${sessionKey}:review`,
  });
  if (reviewOutput.fallbackReason) {
    await emit("thinking", {
      text: `review pass fell back to ${reviewOutput.provider}: ${reviewOutput.fallbackReason}`,
    });
  }

  let finalReply = "";
  const passSummary = readPassSummary(reviewOutput.text);
  if (passSummary) {
    finalReply = passSummary;
  } else {
    const reviewResult = await parseDocWithRecovery({
      modelOutput: reviewOutput.text,
      fallbackTitle: rewriteSnapshot.title ?? params.documentContext.baselineDoc.metadata.title,
      sessionKey: `${sessionKey}:review`,
    });
    await writeAgentDocumentWorkspaceDoc(params.documentContext, reviewResult.doc);
    await emit("tool", {
      phase: "end",
      toolName: "review_rewrite_document",
      turn: 2,
      note: reviewResult.note,
    });
    const reviewSnapshot = await readAgentDocumentSnapshot(params.documentContext);
    await params.onSnapshot?.(reviewSnapshot);
    finalReply = "Applied two autonomous repair passes and wrote the reviewed draft back to the workspace.";
  }

  const finalSnapshot = await readAgentDocumentSnapshot(params.documentContext);
  await emit("assistant", {
    phase: "end",
    fullText: finalReply || "Autonomous document repair finished.",
  });
  await emit("lifecycle", { phase: "end", mode: "document-autonomy" });

  return {
    reply: finalReply || "Autonomous document repair finished.",
    events,
    finalSnapshot,
  };
}

async function parseDocWithRecovery(params: {
  modelOutput: string;
  fallbackTitle: string;
  sessionKey: string;
}): Promise<ParseDocResult> {
  try {
    return {
      doc: parseDocJson(params.modelOutput),
      note: "model returned valid document JSON",
    };
  } catch (error) {
    const repairedOutput = await runDocumentPrompt({
      message: buildDocJsonRepairPrompt({
        fallbackTitle: params.fallbackTitle,
        malformedOutput: params.modelOutput,
      }),
      sessionKey: `${params.sessionKey}:repair`,
    });
    try {
      const repairedDoc = parseDocJson(repairedOutput.text);
      const firstMessage = error instanceof Error ? error.message : String(error);
      return {
        doc: repairedDoc,
        note: repairedOutput.fallbackReason
          ? `repair prompt fell back to ${repairedOutput.provider} after parse failure: ${firstMessage}`
          : `repair prompt used after parse failure: ${firstMessage}`,
      };
    } catch (repairError) {
      const firstMessage = error instanceof Error ? error.message : String(error);
      const repairMessage = repairError instanceof Error ? repairError.message : String(repairError);
      throw new Error(`initial parse failed: ${firstMessage}; repair parse failed: ${repairMessage}`);
    }
  }
}

async function runDocumentPrompt(params: {
  message: string;
  sessionKey: string;
}): Promise<PromptResult> {
  if (shouldUseDirectDocumentAutonomy()) {
    return {
      text: await runSiliconFlowTextPrompt({
        message: params.message,
      }),
      provider: "siliconflow-direct",
      fallbackReason: "current provider uses direct autonomy mode",
    };
  }

  try {
    const text = await runOpenClawTextPrompt({
      message: params.message,
      sessionKey: params.sessionKey,
    });
    return {
      text,
      provider: "openclaw",
    };
  } catch (error) {
    const text = await runSiliconFlowTextPrompt({
      message: params.message,
    });
    return {
      text,
      provider: "siliconflow-direct",
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function shouldUseDirectDocumentAutonomy(): boolean {
  const explicit = process.env.AGENT_DOCUMENT_AUTONOMY_PROVIDER?.trim().toLowerCase();
  if (explicit === "siliconflow-direct") {
    return true;
  }
  if (explicit === "openclaw") {
    return false;
  }

  const provider = process.env.OPENCLAW_PROVIDER?.trim().toLowerCase();
  return provider === "siliconflow";
}

function parseDocJson(modelOutput: string): Doc {
  const candidates = collectJsonCandidates(modelOutput.trim());
  if (candidates.length === 0) {
    throw new Error("model did not return a JSON object");
  }

  let lastError: Error | undefined;
  for (const candidate of candidates) {
    const normalizedCandidates = Array.from(
      new Set([candidate, sanitizeLooseJsonCandidate(candidate)].filter((value) => value.length > 0)),
    );
    for (const normalizedCandidate of normalizedCandidates) {
      try {
        const parsed = JSON.parse(normalizedCandidate) as Doc;
        const normalized = normalizeAutonomyDoc(parsed);
        const validation = isValidDoc(normalized);
        if (!validation.ok) {
          lastError = new Error(validation.errors.join("; "));
          continue;
        }
        return normalized;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError ?? new Error("document JSON is invalid");
}

function normalizeAutonomyDoc(doc: Doc): Doc {
  return {
    ...doc,
    metadata: {
      ...doc.metadata,
      title:
        typeof doc.metadata.title === "string" && doc.metadata.title.trim()
          ? doc.metadata.title.trim()
          : "Untitled document",
    },
    children: normalizeBlocks(doc.children),
  };
}

function normalizeBlocks(blocks: readonly BlockNode[]): readonly BlockNode[] {
  return blocks.map((block) => {
    if (block.type !== "section") {
      return block;
    }

    const normalizedChildren = normalizeBlocks(block.children);
    const titleFromHeading = normalizedChildren[0]?.type === "heading"
      ? normalizedChildren[0].children
          .map((child) => ("text" in child ? child.text ?? "" : ""))
          .join("")
          .trim()
      : "";

    return {
      ...block,
      title:
        typeof block.title === "string" && block.title.trim()
          ? block.title.trim()
          : titleFromHeading || "Untitled section",
      children: normalizedChildren,
    };
  });
}

function buildRewritePrompt(params: {
  userMessage: string;
  currentDocumentJson: string;
  currentPreview: string;
}): string {
  return [
    "You are revising a Black Bean Sprouts document AST.",
    "Return exactly one valid JSON object and nothing else.",
    "Do not return markdown, prose, code fences, or tool XML.",
    "Required root shape:",
    '{ "version": 0, "metadata": { "title": "string" }, "children": [] }',
    "Allowed block types: paragraph, heading, section, abstract, table, figure, formula, reference-list.",
    'Paragraph and heading blocks must use inline text arrays, e.g. {"type":"paragraph","id":"p1","children":[{"type":"text","text":"Body"}]}.',
    "Preserve existing ids when possible. New blocks must use new unique ids.",
    "Keep the document faithful to the user request and keep the final JSON valid.",
    "",
    "User request:",
    params.userMessage,
    "",
    "Current preview:",
    params.currentPreview,
    "",
    "Current document JSON:",
    params.currentDocumentJson,
  ].join("\n");
}

function buildReviewPrompt(params: {
  userMessage: string;
  currentDocumentJson: string;
  currentPreview: string;
}): string {
  return [
    "You are reviewing a revised Black Bean Sprouts document AST.",
    "If the current document already satisfies the user request, return exactly:",
    "PASS: <one short sentence>",
    "If the current document still needs changes, return exactly one corrected valid JSON document object and nothing else.",
    "Do not return markdown, prose, code fences, or tool XML unless the answer is the required PASS line.",
    "",
    "User request:",
    params.userMessage,
    "",
    "Current preview:",
    params.currentPreview,
    "",
    "Current document JSON:",
    params.currentDocumentJson,
  ].join("\n");
}

function buildDocJsonRepairPrompt(params: {
  fallbackTitle: string;
  malformedOutput: string;
}): string {
  return [
    "You repair malformed JSON for a Black Bean Sprouts document AST pipeline.",
    "Return exactly one valid JSON object and nothing else.",
    "Required root keys: version, metadata, children.",
    "metadata.title must be a non-empty string.",
    "children must be an array of block nodes.",
    "Allowed block types: paragraph, heading, section, abstract, table, figure, formula, reference-list.",
    "Delete any stray prose, code fences, comments, or tool tags.",
    `Fallback title: ${params.fallbackTitle}`,
    "Malformed content starts:",
    params.malformedOutput,
    "Malformed content ends.",
  ].join("\n");
}

function readPassSummary(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed.toUpperCase().startsWith("PASS:")) {
    return undefined;
  }
  return trimmed.slice(5).trim() || "Autonomous review passed.";
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
