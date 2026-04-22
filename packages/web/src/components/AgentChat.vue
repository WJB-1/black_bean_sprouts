<template>
  <div class="apple-chat">
    <div ref="messagesRef" class="apple-chat-messages">
      <section v-if="messages.length === 0 && !streaming" class="apple-empty" style="min-height: 280px;">
        <div>
          <p class="apple-kicker">Start With Prompt</p>
          <h3 style="margin-top: 0;">开始和 Agent 协作</h3>
          <p class="apple-muted">例如：补全摘要、生成目录、把引言改得更学术，或直接要求增删章节。</p>
        </div>
      </section>

      <template v-else>
        <div v-for="message in messages" :key="message.id" class="apple-chat-row" :class="message.role">
          <div class="apple-chat-bubble" :class="message.role">{{ message.content }}</div>
        </div>

        <div v-if="streaming" class="apple-chat-row assistant">
          <div class="apple-chat-bubble assistant">
            {{ streamText || "正在思考…" }}<span class="cursor">|</span>
          </div>
        </div>
      </template>
    </div>

    <div class="apple-chat-composer">
      <p v-if="activityText" class="apple-muted" style="margin: 0;">{{ activityText }}</p>

      <n-input
        v-model:value="input"
        type="textarea"
        placeholder="告诉 Agent 你想完成什么，例如：title: 论文新标题; section: 引言"
        :autosize="{ minRows: 2, maxRows: 6 }"
        :disabled="streaming"
        @keydown="handleComposerKeydown"
      />

      <div class="apple-actions" style="justify-content: space-between; align-items: center;">
        <span class="apple-muted">Enter 发送 · Shift+Enter 换行</span>
        <div class="apple-actions">
          <n-button v-if="streaming" @click="cancelStream">停止</n-button>
          <n-button type="primary" :disabled="!input.trim() || streaming" :loading="streaming" @click="handleSend">
            发送给 Agent
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from "vue";
import { getAccessToken } from "../lib/token.js";

type ChatRole = "user" | "assistant" | "system";
type ChatMessage = { id: string; role: ChatRole; content: string };
type ChatEvent =
  | { type: "session_created"; sessionId: string }
  | { type: "kernel_session"; sessionKey: string }
  | { type: "kernel_lifecycle"; phase: "start" | "end" | "error"; message?: string }
  | { type: "message_delta"; text: string }
  | { type: "tool_call_start"; tool: string }
  | { type: "tool_call_result"; result: { llmVisible?: { summary?: string } } }
  | { type: "document_patched" }
  | { type: "error"; error: { message: string } }
  | { type: "done" };

const props = defineProps<{ documentId: string }>();
const emit = defineEmits<{ "document-patched": [] }>();

const messages = ref<ChatMessage[]>([]);
const input = ref("");
const streaming = ref(false);
const streamText = ref("");
const activityText = ref("");
const sessionId = ref<string | null>(null);
const messagesRef = ref<HTMLElement | null>(null);
const patchDuringStream = ref(false);

let abortController: AbortController | null = null;

watch(() => props.documentId, () => {
  abortController?.abort();
  messages.value = [];
  input.value = "";
  streamText.value = "";
  activityText.value = "";
  sessionId.value = null;
  patchDuringStream.value = false;
});

onUnmounted(() => {
  abortController?.abort();
});

function appendMessage(role: ChatRole, content: string): void {
  messages.value.push({ id: crypto.randomUUID(), role, content });
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void handleSend();
  }
}

function cancelStream(): void {
  abortController?.abort();
}

async function handleStreamEvent(event: ChatEvent): Promise<void> {
  switch (event.type) {
    case "session_created":
      sessionId.value = event.sessionId;
      activityText.value = "会话已创建";
      return;
    case "kernel_session":
      activityText.value = `Kernel 会话：${event.sessionKey}`;
      return;
    case "kernel_lifecycle":
      activityText.value = event.phase === "error"
        ? event.message || "Kernel 运行失败"
        : `Kernel ${event.phase === "start" ? "已启动" : "已完成"}`;
      return;
    case "message_delta":
      streamText.value += event.text;
      await nextTick();
      scrollToBottom();
      return;
    case "tool_call_start":
      activityText.value = `正在调用工具：${event.tool}`;
      return;
    case "tool_call_result":
      activityText.value = event.result.llmVisible?.summary || "工具执行完成";
      return;
    case "document_patched":
      patchDuringStream.value = true;
      activityText.value = "文档补丁已写入";
      return;
    case "error":
      throw new Error(event.error.message);
    case "done":
      activityText.value = activityText.value || "回答完成";
  }
}

async function consumeSse(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("无法读取流式响应");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        await handleStreamEvent(JSON.parse(data) as ChatEvent);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function handleSend(): Promise<void> {
  const text = input.value.trim();
  if (!text || streaming.value) return;

  appendMessage("user", text);
  input.value = "";
  streamText.value = "";
  activityText.value = "正在连接 Agent…";
  patchDuringStream.value = false;
  streaming.value = true;
  await nextTick();
  scrollToBottom();

  abortController = new AbortController();
  try {
    const token = getAccessToken();
    if (!token) {
      throw new Error("请先登录");
    }

    const response = await fetch("/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: text,
        sessionId: sessionId.value ?? undefined,
        documentId: props.documentId,
        skillCode: "thesis",
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      throw new Error("服务端返回的不是流式响应");
    }

    await consumeSse(response);
    appendMessage("assistant", streamText.value.trim() || "已完成文档处理。");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      appendMessage("system", "本次生成已停止。");
    } else {
      appendMessage("system", error instanceof Error ? error.message : "发送失败，请稍后重试。");
    }
  } finally {
    const shouldNotify = patchDuringStream.value;
    streaming.value = false;
    streamText.value = "";
    patchDuringStream.value = false;
    abortController = null;
    if (shouldNotify) {
      emit("document-patched");
    }
    await nextTick();
    scrollToBottom();
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) {
    return `请求失败 (${response.status})`;
  }
  try {
    const body = JSON.parse(raw) as { error?: { message?: string } };
    return body.error?.message ?? raw;
  } catch {
    return raw;
  }
}

function scrollToBottom(): void {
  if (!messagesRef.value) return;
  messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
}
</script>

<style scoped>
.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
