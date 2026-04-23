<template>
  <div class="editor-page">
    <header class="toolbar">
      <h1 class="logo">黑豆芽</h1>
      <nav class="toolbar-nav">
        <router-link to="/">编辑器</router-link>
        <router-link to="/admin">后台管理</router-link>
      </nav>
    </header>
    <main class="content">
      <div class="editor-panel"><BlockTreeEditor :document-id="effectiveDocumentId" /></div>
      <aside class="agent-panel"><AgentChat /></aside>
    </main>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import BlockTreeEditor from "../components/editor/BlockTreeEditor.vue";
import AgentChat from "../components/agent/AgentChat.vue";

const route = useRoute();
const documentId = computed(() => route.params.id as string);
const effectiveDocumentId = computed(() => {
  const id = documentId.value;
  return id === "new" ? undefined : id;
});
</script>

<style scoped>
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f8f9fa;
  color: #1a1a1a;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}
.logo { font-size: 18px; font-weight: 700; margin: 0; color: #2d2d2d; }
.toolbar-nav { display: flex; gap: 16px; }
.toolbar-nav a {
  text-decoration: none; color: #666; font-size: 14px;
  padding: 4px 8px; border-radius: 4px; transition: all 0.15s;
}
.toolbar-nav a:hover, .toolbar-nav a.router-link-active {
  color: #4a90d9; background: #f0f4ff;
}
.content { flex: 1; display: flex; overflow: hidden; }
.editor-panel {
  flex: 1; overflow-y: auto; padding: 24px 32px;
  background: #fff; border-right: 1px solid #e0e0e0;
}
.agent-panel {
  width: 360px; flex-shrink: 0; display: flex; flex-direction: column;
  background: #fafbfc;
}
</style>
