<template>
  <div class="agent-chat">
    <div class="agent-chat-header">Agent 助手</div>
    <div class="agent-messages">
      <div v-for="msg in messages" :key="msg.id" :class="['agent-message', 'agent-message--' + msg.role]">
        <span class="agent-message-role">{{ msg.role === 'user' ? '你' : msg.role === 'assistant' ? 'AI' : '!' }}</span>
        <span class="agent-message-content">{{ msg.content }}</span>
      </div>
      <div v-if="messages.length === 0" class="agent-empty">输入指令让 AI 帮你编辑文档</div>
    </div>
    <form class="agent-input-bar" @submit.prevent="sendMessage">
      <input v-model="input" placeholder="输入指令..." />
      <button type="submit">发送</button>
    </form>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
const input = ref("");
const messages = ref<{ id: string; role: string; content: string }[]>([]);
async function sendMessage() {
  if (!input.value.trim()) return;
  messages.value.push({ id: Date.now().toString(), role: "user", content: input.value });
  const msg = input.value;
  input.value = "";
  try {
    const res = await fetch("/api/agent/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const data = (await res.json()) as { reply?: string };
    messages.value.push({ id: Date.now().toString(), role: "assistant", content: data.reply ?? "无响应" });
  } catch { messages.value.push({ id: Date.now().toString(), role: "error", content: "请求失败" }); }
}
</script>

<style scoped>
.agent-chat { display: flex; flex-direction: column; height: 100%; }
.agent-chat-header {
  padding: 12px 16px; font-weight: 600; font-size: 14px;
  border-bottom: 1px solid #e0e0e0; color: #333;
}
.agent-messages { flex: 1; overflow-y: auto; padding: 12px 16px; }
.agent-empty { color: #999; font-size: 13px; text-align: center; padding-top: 40px; }
.agent-message { display: flex; gap: 8px; margin-bottom: 10px; font-size: 13px; line-height: 1.5; }
.agent-message-role {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600;
}
.agent-message--user .agent-message-role { background: #e8f0fe; color: #4a90d9; }
.agent-message--assistant .agent-message-role { background: #e8f5e9; color: #4caf50; }
.agent-message--error .agent-message-role { background: #fce4ec; color: #e53935; }
.agent-message-content { flex: 1; padding-top: 4px; word-break: break-word; }
.agent-input-bar { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #e0e0e0; }
.agent-input-bar input {
  flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px;
  font-size: 13px; outline: none;
}
.agent-input-bar input:focus { border-color: #4a90d9; }
.agent-input-bar button {
  background: #4a90d9; color: #fff; border: none; border-radius: 6px;
  padding: 8px 16px; font-size: 13px; cursor: pointer;
}
.agent-input-bar button:hover { background: #3a7bc8; }
</style>
