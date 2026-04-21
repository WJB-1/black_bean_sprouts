<template>
  <div class="agent-chat">
    <div class="messages" ref="messagesRef">
      <div v-for="msg in messages" :key="msg.id" :class="['message', msg.role]">
        <div class="bubble">{{ msg.content }}</div>
      </div>
      <div v-if="streaming" class="message assistant">
        <div class="bubble">{{ streamText }}<span class="cursor">|</span></div>
      </div>
    </div>
    <div class="input-area">
      <n-input
        v-model:value="input"
        placeholder="告诉 Agent 你想做什么..."
        @keyup.enter="handleSend"
        :disabled="streaming"
      />
      <n-button type="primary" @click="handleSend" :disabled="!input || streaming">发送</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useMessage, NInput, NButton, type MessageReactive } from "naive-ui";
import { getAccessToken } from "../lib/token.js";

const props = defineProps<{ documentId: string }>();
const messageApi = useMessage();

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const messages = ref<ChatMessage[]>([]);
const input = ref("");
const streaming = ref(false);
const streamText = ref("");
const messagesRef = ref<HTMLElement | null>(null);

async function handleSend(): Promise<void> {
  const text = input.value.trim();
  if (!text || streaming.value) return;

  messages.value.push({ id: crypto.randomUUID(), role: "user", content: text });
  input.value = "";
  streaming.value = true;
  streamText.value = "";

  await nextTick();
  scrollToBottom();

  try {
    const token = getAccessToken();
    if (!token) {
      throw new Error("未登录");
    }

    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: text,
        documentId: props.documentId,
        skillCode: "thesis",
      }),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: { message?: string } };
      throw new Error(body.error?.message ?? "请求失败");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("无响应流");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const event = JSON.parse(jsonStr) as { type: string; text?: string };
          if (event.type === "message_delta" && event.text) {
            streamText.value += event.text;
            await nextTick();
            scrollToBottom();
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    messages.value.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: streamText.value || "（无回复）",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "发送失败";
    messageApi.error(errorMessage);
  } finally {
    streaming.value = false;
    streamText.value = "";
  }
}

function scrollToBottom(): void {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
}
</script>

<style scoped>
.agent-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.message {
  margin-bottom: 12px;
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 8px;
  white-space: pre-wrap;
  font-size: 14px;
}

.message.user .bubble {
  background: #18a058;
  color: white;
}

.message.assistant .bubble {
  background: #f0f0f0;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #eee;
}
</style>
