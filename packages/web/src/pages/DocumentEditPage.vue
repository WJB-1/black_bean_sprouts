<template>
  <div style="display: flex; height: 100vh">
    <!-- Editor panel -->
    <div style="flex: 1; overflow: auto; background: #f5f5f5">
      <n-spin :show="docStore.loading">
        <template v-if="docError">
          <n-result status="error" title="加载失败" :description="docError">
            <template #footer>
              <n-button @click="handleRetry">重试</n-button>
              <n-button style="margin-left: 8px" @click="router.push({ name: 'documents' })">
                返回列表
              </n-button>
            </template>
          </n-result>
        </template>
        <template v-else-if="!docStore.loading && !docStore.currentDoc">
          <n-result status="404" title="文档不存在" description="该文档可能已被删除或您没有访问权限">
            <template #footer>
              <n-button type="primary" @click="router.push({ name: 'documents' })">
                返回文档列表
              </n-button>
            </template>
          </n-result>
        </template>
        <doc-editor v-else :doc="docContent" />
      </n-spin>
    </div>
    <!-- Agent chat panel -->
    <div style="width: 380px; border-left: 1px solid #eee; display: flex; flex-direction: column">
      <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center">
        <strong>Agent 助手</strong>
        <n-button size="small" @click="handleRender" :loading="rendering" :disabled="!docStore.currentDoc">
          渲染 Word
        </n-button>
      </div>
      <agent-chat :document-id="docId" style="flex: 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage, NSpin, NButton, NResult } from "naive-ui";
import { useDocumentStore } from "../stores/document.js";
import DocEditor from "../components/DocEditor.vue";
import AgentChat from "../components/AgentChat.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const docStore = useDocumentStore();

const docId = computed(() => route.params["id"] as string);
const rendering = ref(false);
const docError = ref<string | null>(null);

// Validate docId format
const isValidDocId = computed(() => {
  const id = docId.value;
  return id && typeof id === "string" && id.length > 0 && id !== "undefined" && id !== "null";
});

const docContent = computed(() => {
  return docStore.currentDoc?.content as Record<string, unknown> | null;
});

onMounted(() => {
  if (!isValidDocId.value) {
    docError.value = "无效的文档 ID";
    return;
  }
  void fetchDocument();
});

// Cleanup on unmount (handle render cancellation)
let abortRenderController: AbortController | null = null;
onUnmounted(() => {
  abortRenderController?.abort();
});

async function fetchDocument(): Promise<void> {
  if (!isValidDocId.value) {
    docError.value = "无效的文档 ID";
    return;
  }

  docError.value = null;
  try {
    await docStore.fetchDoc(docId.value);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "加载文档失败";
    docError.value = errorMessage;
    // Check if it's a 404 error
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      docError.value = "文档不存在或已被删除";
    }
  }
}

function handleRetry(): void {
  void fetchDocument();
}

async function handleRender(): Promise<void> {
  if (!docStore.currentDoc) {
    message.warning("请先加载文档");
    return;
  }

  rendering.value = true;
  abortRenderController = new AbortController();

  try {
    const blob = await docStore.renderDocument(docId.value, abortRenderController.signal);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const docTitle = docStore.currentDoc?.title ?? "document";
    a.download = `${docTitle}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("渲染完成，已下载");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // User cancelled - don't show error
      return;
    }
    const errorMessage = err instanceof Error ? err.message : "渲染失败";
    message.error(errorMessage);
  } finally {
    rendering.value = false;
    abortRenderController = null;
  }
}
</script>
