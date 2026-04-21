<template>
  <div class="agent-chat">
    <div class="messages" ref="messagesRef">
      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-else-if="messages.length === 0 && !streaming" class="empty-state">
        开始与 Agent 对话，让 AI 帮助你写作
      </div>
      <template v-else>
        <div v-for="msg in messages" :key="msg.id" :class="['message', msg.role]">
          <div class="bubble">{{ msg.content }}</div>
        </div>
        <div v-if="streaming" class="message assistant">
          <div class="bubble">
            <span v-if="streamText">{{ streamText }}</span>
            <span v-else class="loading-text">正在思考...</span>
            <span class="cursor">|</span>
          </div>
        </div>
      </template>
    </div>
    <div class="input-area">
      <n-input
        v-model:value="input"
        placeholder="告诉 Agent 你想做什么..."
        @keyup.enter="handleSend"
        :disabled="streaming"
        :maxlength="2000"
        show-count
      />
      <n-button type="primary" @click="handleSend" :disabled="!input.trim() || streaming" :loading="streaming">
        发送
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onUnmounted } from "vue";
import { useMessage, NInput, NButton } from "naive-ui";
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
const error = ref<string | null>(null);

let abortController: AbortController | null = null;

onUnmounted(() => {
  // Cancel any ongoing request when component unmounts
  abortController?.abort();
});

async function handleSend(): Promise<void> {
  const text = input.value.trim();
  if (!text || streaming.value) return;

  error.value = null;
  messages.value.push({ id: crypto.randomUUID(), role: "user", content: text });
  input.value = "";
  streaming.value = true;
  streamText.value = "";

  await nextTick();
  scrollToBottom();

  abortController = new AbortController();

  try {
    const token = getAccessToken();
    if (!token) {
      throw new Error("请先登录");
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
      signal: abortController.signal,
    });

    // Handle non-SSE errors (401, 403, 404, 500, etc.)
    if (!res.ok) {
      // Try to parse error response
      let errorMsg = `请求失败 (${res.status})`;
      try {
        const contentType = res.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const body = await res.json() as { error?: { message?: string } };
          errorMsg = body.error?.message ?? errorMsg;
        } else {
          // Non-JSON response (might be HTML error page)
          errorMsg = res.status === 401 ? "登录已过期，请重新登录" : `服务器错误 (${res.status})`;
        }
      } catch {
        // If parsing fails, use default error
      }
      throw new Error(errorMsg);
    }

    // Check if response is actually SSE
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("text/event-stream")) {
      throw new Error("服务器返回了无效的响应格式");
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("无法读取响应流");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          if (trimmed === "data: [DONE]") continue;

          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr) as { type: string; text?: string; error?: string };
            if (event.error) {
              throw new Error(event.error);
            }
            if (event.type === "message_delta" && event.text) {
              streamText.value += event.text;
              await nextTick();
              scrollToBottom();
            }
          } catch (parseError) {
            // Skip invalid JSON but log for debugging
            console.warn("Failed to parse SSE event:", jsonStr, parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Add the complete message to history
    messages.value.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: streamText.value || "（无回复）",
    });
  } catch (err) {
    // Handle different error types
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        // Request was cancelled, don't show error
        return;
      }
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        error.value = "网络连接失败，请检查网络后重试";
        messageApi.error("网络连接失败");
      } else {
        error.value = err.message;
        messageApi.error(err.message);
      }
    } else {
      error.value = "发送失败，请重试";
      messageApi.error("发送失败，请重试");
    }
    // Remove the user message on error so they can retry
    messages.value.pop();
  } finally {
    streaming.value = false;
    streamText.value = "";
    abortController = null;
    await nextTick();
    scrollToBottom();
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

.loading-text {
  color: #999;
  font-style: italic;
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

.error-message {
  padding: 16px;
  background: #fff0f0;
  border-left: 4px solid #f5222d;
  color: #f5222d;
  border-radius: 4px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-style: italic;
}
</style>
