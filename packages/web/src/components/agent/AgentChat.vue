<template>
  <div class="agent-chat">
    <div class="agent-chat-header">
      <div>
        <div class="agent-chat-title">Xiaolongxia Agent</div>
        <div class="agent-chat-subtitle">
          {{ props.documentId ? `doc ${props.documentId}` : "draft session" }}
        </div>
      </div>
      <button class="ghost-btn" type="button" :disabled="sending" @click="resetSession">
        New session
      </button>
    </div>

    <div ref="messageViewport" class="agent-messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['agent-message', 'agent-message--' + msg.role]"
      >
        <span class="agent-message-role">
          {{ msg.role === "user" ? "U" : msg.role === "assistant" ? "AI" : "!" }}
        </span>
        <span class="agent-message-content">{{ msg.content }}</span>
      </div>
      <div v-if="messages.length === 0" class="agent-empty">
        Ask the agent to inspect, revise, or repair the current draft.
      </div>
    </div>

    <section class="trace-panel">
      <div class="trace-header">
        <div>
          <strong>Kernel trace</strong>
          <span class="trace-meta">session {{ sessionKey }}</span>
        </div>
        <span :class="['trace-status', `trace-status--${runStatus}`]">
          {{ runStatusLabel }}
        </span>
      </div>

      <div ref="traceViewport" class="trace-events">
        <div v-if="traceEvents.length === 0" class="trace-empty">
          Live events will appear here.
        </div>
        <div v-for="event in traceEvents" :key="eventKey(event)" class="trace-event">
          <span class="trace-seq">#{{ event.seq }}</span>
          <span class="trace-stream">{{ event.stream }}</span>
          <span class="trace-summary">{{ summarizeEvent(event) }}</span>
        </div>
      </div>
    </section>

    <section class="snapshot-panel">
      <div class="trace-header">
        <div>
          <strong>Draft snapshots</strong>
          <span class="trace-meta">{{ snapshotHistory.length }} update(s)</span>
        </div>
        <span
          v-if="latestSnapshot"
          :class="[
            'trace-status',
            latestSnapshot.parseError || latestSnapshot.validationErrors?.length
              ? 'trace-status--error'
              : 'trace-status--done',
          ]"
        >
          {{
            latestSnapshot.parseError
              ? "json error"
              : latestSnapshot.validationErrors?.length
                ? "schema warning"
                : "valid"
          }}
        </span>
      </div>

      <div v-if="!latestSnapshot" class="trace-empty">
        Intermediate document drafts will appear here after write/edit steps.
      </div>
      <div v-else class="snapshot-body">
        <div class="snapshot-meta-row">
          <strong>{{ latestSnapshot.title || "Untitled draft" }}</strong>
          <span>
            {{ latestSnapshot.blockCount ?? "?" }} block(s) / {{ latestSnapshot.sectionCount ?? "?" }} section(s)
          </span>
        </div>
        <p v-if="latestSnapshot.parseError" class="snapshot-error">
          JSON parse failed: {{ latestSnapshot.parseError }}
        </p>
        <p
          v-else-if="latestSnapshot.validationErrors?.length"
          class="snapshot-error"
        >
          Schema validation failed: {{ latestSnapshot.validationErrors.join("; ") }}
        </p>
        <pre class="snapshot-preview">{{
          latestSnapshot.previewMarkdown || latestSnapshot.rawJson
        }}</pre>
      </div>
    </section>

    <form class="agent-input-bar" @submit.prevent="sendMessage">
      <textarea
        v-model="input"
        class="agent-input"
        rows="3"
        :disabled="sending"
        placeholder="Example: inspect this draft, list structural problems, then propose the next repair step."
      />
      <div class="agent-actions">
        <button class="primary-btn" type="submit" :disabled="sending || !input.trim()">
          {{ sending ? "Running..." : "Send" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { Doc } from "@black-bean-sprouts/doc-schema";
import { useDocumentStore } from "../../stores/document.js";

type MessageRole = "user" | "assistant" | "error";

type AgentMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

type KernelEvent = {
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};

type AgentSnapshot = {
  workspaceDir: string;
  documentPath: string;
  previewPath: string;
  instructionsPath: string;
  rawJson: string;
  previewMarkdown: string;
  parseError?: string;
  validationErrors?: string[];
  title?: string;
  blockCount?: number;
  sectionCount?: number;
  hash: string;
};

type StreamRecord =
  | { type: "event"; event: KernelEvent; reply?: string }
  | { type: "snapshot"; snapshot: AgentSnapshot }
  | { type: "persisted"; persisted: boolean; updated: boolean; version?: number; documentId?: string; doc?: Doc }
  | { type: "done"; reply?: string; eventCount?: number }
  | { type: "error"; error: string };

const props = defineProps<{ documentId?: string }>();

const AGENT_SESSION_PREFIX = "bbs.agent.session";

const documentStore = useDocumentStore();
const input = ref("");
const sending = ref(false);
const messages = ref<AgentMessage[]>([]);
const traceEvents = ref<KernelEvent[]>([]);
const snapshotHistory = ref<AgentSnapshot[]>([]);
const runStatus = ref<"idle" | "running" | "done" | "error">("idle");
const sessionKey = ref(resolveSessionKey(props.documentId));
const messageViewport = ref<HTMLElement | null>(null);
const traceViewport = ref<HTMLElement | null>(null);
const latestSnapshot = computed(() => snapshotHistory.value.at(-1));

const runStatusLabel = computed(() => {
  switch (runStatus.value) {
    case "running":
      return "running";
    case "done":
      return "completed";
    case "error":
      return "failed";
    default:
      return "idle";
  }
});

watch(
  () => props.documentId,
  (documentId) => {
    sessionKey.value = resolveSessionKey(documentId);
    traceEvents.value = [];
    snapshotHistory.value = [];
    runStatus.value = "idle";
  },
);

watch(
  messages,
  async () => {
    await nextTick();
    if (messageViewport.value) {
      messageViewport.value.scrollTop = messageViewport.value.scrollHeight;
    }
  },
  { deep: true },
);

watch(
  traceEvents,
  async () => {
    await nextTick();
    if (traceViewport.value) {
      traceViewport.value.scrollTop = traceViewport.value.scrollHeight;
    }
  },
  { deep: true },
);

function resolveSessionKey(documentId?: string): string {
  const scope = documentId?.trim() || "draft";
  const storageKey = `${AGENT_SESSION_PREFIX}.${scope}`;
  const existing = window.localStorage.getItem(storageKey)?.trim();
  if (existing) {
    return existing;
  }
  const next = buildSessionKey(scope);
  window.localStorage.setItem(storageKey, next);
  return next;
}

function buildSessionKey(scope: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `agent-${scope}-${suffix}`;
}

function replaceSessionKey(documentId?: string): string {
  const scope = documentId?.trim() || "draft";
  const storageKey = `${AGENT_SESSION_PREFIX}.${scope}`;
  const next = buildSessionKey(scope);
  window.localStorage.setItem(storageKey, next);
  return next;
}

function resetSession() {
  sessionKey.value = replaceSessionKey(props.documentId);
  messages.value = [];
  traceEvents.value = [];
  snapshotHistory.value = [];
  runStatus.value = "idle";
}

function createMessage(role: MessageRole, content: string): AgentMessage {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
  };
}

function eventKey(event: KernelEvent): string {
  return `${event.runId}:${event.seq}:${event.stream}`;
}

function summarizeEvent(event: KernelEvent): string {
  const data = event.data ?? {};
  switch (event.stream) {
    case "lifecycle":
      return joinSummary([
        readString(data.phase),
        readString(data.message),
        readString(data.error),
      ]);
    case "tool":
      return joinSummary([
        readString(data.phase),
        readString(data.toolName ?? data.name),
        readString(data.error),
      ]);
    case "assistant":
      return joinSummary([
        readString(data.phase ?? data.assistantPhase),
        truncate(readString(data.delta) ?? readString(data.fullText), 120),
      ]);
    case "thinking":
      return truncate(
        readString(data.text) ??
          readString(data.delta) ??
          readString(data.content) ??
          JSON.stringify(data),
        120,
      );
    case "plan":
      return truncate(
        readString(data.text) ??
          readString(data.summary) ??
          JSON.stringify(data),
        120,
      );
    case "patch":
      return joinSummary([
        `version ${readNumber(data.version) ?? "?"}`,
        `${readArrayLength(data.patches)} patch`,
      ]);
    case "command_output":
      return truncate(readString(data.text) ?? JSON.stringify(data), 120);
    case "error":
      return truncate(readString(data.error) ?? JSON.stringify(data), 120);
    default:
      return truncate(JSON.stringify(data), 120);
  }
}

function joinSummary(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" | ");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function truncate(value: string | undefined, maxLength: number): string {
  if (!value) {
    return "";
  }
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message || sending.value) {
    return;
  }

  const userMessage = createMessage("user", message);
  const assistantMessage = createMessage("assistant", "");
  messages.value.push(userMessage, assistantMessage);
  input.value = "";
  traceEvents.value = [];
  snapshotHistory.value = [];
  runStatus.value = "running";
  sending.value = true;

  try {
    const response = await fetch("/api/agent/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        documentId: props.documentId,
        sessionKey: sessionKey.value,
      }),
    });

    if (!response.ok) {
      const failureText = await response.text();
      throw new Error(failureText.trim() || `agent request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("agent stream body is empty");
    }

    await consumeNdjson(response.body, (record) => {
      if (record.type === "event") {
        traceEvents.value.push(record.event);
        if (typeof record.reply === "string") {
          assistantMessage.content = record.reply;
        }
        return;
      }

      if (record.type === "snapshot") {
        snapshotHistory.value.push(record.snapshot);
        return;
      }

      if (record.type === "persisted") {
        if (record.doc && props.documentId && record.documentId === props.documentId) {
          documentStore.replaceDocument(record.doc, record.documentId);
        }
        return;
      }

      if (record.type === "done") {
        assistantMessage.content = record.reply?.trim() || assistantMessage.content || "(empty)";
        runStatus.value = "done";
        return;
      }

      throw new Error(record.error || "agent stream failed");
    });

    if (runStatus.value === "running") {
      runStatus.value = "done";
    }
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = "(empty)";
    }
  } catch (error) {
    runStatus.value = "error";
    messages.value.push(
      createMessage("error", error instanceof Error ? error.message : "agent request failed"),
    );
  } finally {
    sending.value = false;
  }
}

async function consumeNdjson(
  stream: ReadableStream<Uint8Array>,
  onRecord: (record: StreamRecord) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        onRecord(JSON.parse(line) as StreamRecord);
      }
      newlineIndex = buffer.indexOf("\n");
    }

    if (done) {
      const tail = buffer.trim();
      if (tail) {
        onRecord(JSON.parse(tail) as StreamRecord);
      }
      break;
    }
  }
}
</script>

<style scoped>
.agent-chat {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  height: 100%;
  min-height: 0;
  background: #f7f8fb;
}

.agent-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #dde3ee;
  background: linear-gradient(135deg, #ffffff, #f3f6fb);
}

.agent-chat-title {
  font-size: 14px;
  font-weight: 700;
  color: #152033;
}

.agent-chat-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #62708a;
}

.agent-messages {
  overflow-y: auto;
  padding: 14px 16px;
}

.agent-empty,
.trace-empty {
  color: #7a879c;
  font-size: 12px;
  text-align: center;
  padding: 18px 8px;
}

.agent-message {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.55;
}

.agent-message-role {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.agent-message--user .agent-message-role {
  background: #dbeafe;
  color: #1d4ed8;
}

.agent-message--assistant .agent-message-role {
  background: #dcfce7;
  color: #15803d;
}

.agent-message--error .agent-message-role {
  background: #fee2e2;
  color: #b91c1c;
}

.agent-message-content {
  flex: 1;
  padding-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #1c2535;
}

.trace-panel {
  border-top: 1px solid #dde3ee;
  background: #ffffff;
}

.snapshot-panel {
  border-top: 1px solid #dde3ee;
  background: #fdfefe;
}

.trace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #eef2f8;
}

.trace-meta {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  color: #7a879c;
}

.trace-status {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.trace-status--idle {
  background: #edf2f7;
  color: #516074;
}

.trace-status--running {
  background: #dbeafe;
  color: #1d4ed8;
}

.trace-status--done {
  background: #dcfce7;
  color: #15803d;
}

.trace-status--error {
  background: #fee2e2;
  color: #b91c1c;
}

.trace-events {
  max-height: 210px;
  overflow-y: auto;
  padding: 8px 10px 12px;
}

.trace-event {
  display: grid;
  grid-template-columns: 50px 88px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 7px 6px;
  border-radius: 8px;
  font-size: 12px;
}

.trace-event:nth-child(odd) {
  background: #f8fafc;
}

.trace-seq {
  color: #62708a;
  font-variant-numeric: tabular-nums;
}

.trace-stream {
  color: #0f172a;
  font-weight: 700;
}

.trace-summary {
  color: #334155;
  word-break: break-word;
}

.snapshot-body {
  padding: 10px 12px 14px;
}

.snapshot-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #516074;
}

.snapshot-error {
  margin: 0 0 10px;
  font-size: 12px;
  color: #b91c1c;
}

.snapshot-preview {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 10px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.agent-input-bar {
  display: grid;
  gap: 10px;
  padding: 14px 16px 16px;
  border-top: 1px solid #dde3ee;
  background: #f7f8fb;
}

.agent-input {
  width: 100%;
  resize: vertical;
  min-height: 72px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  font: inherit;
  color: #172033;
  background: #ffffff;
  outline: none;
}

.agent-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.agent-actions {
  display: flex;
  justify-content: flex-end;
}

.primary-btn,
.ghost-btn {
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn {
  border: none;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}

.primary-btn:disabled,
.ghost-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ghost-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
}
</style>
