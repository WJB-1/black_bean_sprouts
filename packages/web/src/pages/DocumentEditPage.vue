<template>
  <div style="display: flex; height: 100vh">
    <!-- Editor panel -->
    <div style="flex: 1; overflow: auto; background: #f5f5f5">
      <n-spin :show="docStore.loading">
        <doc-editor :doc="docContent" />
      </n-spin>
    </div>
    <!-- Agent chat panel -->
    <div style="width: 380px; border-left: 1px solid #eee; display: flex; flex-direction: column">
      <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center">
        <strong>Agent 助手</strong>
        <n-button size="small" @click="handleRender" :loading="rendering">渲染 Word</n-button>
      </div>
      <agent-chat :document-id="docId" style="flex: 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useMessage, NSpin, NButton, type MessageReactive } from "naive-ui";
import { useDocumentStore } from "../stores/document.js";
import DocEditor from "../components/DocEditor.vue";
import AgentChat from "../components/AgentChat.vue";

const route = useRoute();
const message = useMessage();
const docStore = useDocumentStore();

const docId = computed(() => route.params["id"] as string);
const rendering = ref(false);

const docContent = computed(() => {
  return docStore.currentDoc?.content as Record<string, unknown> | null;
});

onMounted(() => {
  void docStore.fetchDoc(docId.value);
});

async function handleRender(): Promise<void> {
  rendering.value = true;
  try {
    const blob = await docStore.renderDocument(docId.value);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const docTitle = docStore.currentDoc?.title ?? "document";
    a.download = `${docTitle}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("渲染完成，已下载");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "渲染失败";
    message.error(errorMessage);
  } finally {
    rendering.value = false;
  }
}
</script>
