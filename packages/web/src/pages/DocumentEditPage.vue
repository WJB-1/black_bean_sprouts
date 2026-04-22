<template>
  <div class="apple-page">
    <div class="apple-shell">
      <header class="apple-panel apple-toolbar">
        <div>
          <p class="apple-kicker">Editor</p>
          <h1 class="apple-section-title" style="margin: 0;">{{ docTitle }}</h1>
          <div class="apple-header-meta" style="margin-top: 10px;">
            <n-tag :type="formatStatusType(docStatus)" round>
              {{ formatStatusLabel(docStatus) }}
            </n-tag>
            <span class="apple-badge">文档 ID：{{ docId }}</span>
            <span class="apple-badge">最近更新：{{ updatedAtLabel }}</span>
          </div>
        </div>
        <div class="apple-actions">
          <n-button @click="router.push({ name: 'documents' })">返回列表</n-button>
          <n-button @click="reloadDocument" :loading="docStore.loading">重新加载</n-button>
          <n-button
            type="primary"
            :loading="rendering"
            :disabled="!docStore.currentDoc"
            @click="handleRender"
          >
            导出 Word
          </n-button>
        </div>
      </header>

      <div class="apple-editor-layout">
        <section class="apple-panel apple-editor-canvas">
          <n-spin :show="docStore.loading">
            <n-result
              v-if="docError"
              status="error"
              title="文档加载失败"
              :description="docError"
              style="padding: 48px 20px;"
            >
              <template #footer>
                <div class="apple-actions" style="justify-content: center;">
                  <n-button @click="reloadDocument">重试</n-button>
                  <n-button type="primary" @click="router.push({ name: 'documents' })">
                    返回列表
                  </n-button>
                </div>
              </template>
            </n-result>

            <n-result
              v-else-if="!docStore.loading && !docStore.currentDoc"
              status="404"
              title="文档不存在"
              description="该文档可能已被删除，或者你没有访问权限。"
              style="padding: 48px 20px;"
            >
              <template #footer>
                <n-button type="primary" @click="router.push({ name: 'documents' })">
                  回到文档中心
                </n-button>
              </template>
            </n-result>

            <doc-editor v-else :doc="docContent" />
          </n-spin>
        </section>

        <aside class="apple-panel apple-chat-panel">
          <div class="apple-chat-header">
            <p class="apple-kicker">Agent</p>
            <h2 class="apple-section-title" style="margin-top: 0;">智能协作面板</h2>
            <p class="apple-muted">直接描述你的修改需求，Agent 会结合当前文档上下文进行处理。</p>
          </div>
          <agent-chat :document-id="docId" />
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Doc } from "@black-bean-sprouts/doc-schema";
import { computed, onUnmounted, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import { useRoute, useRouter } from "vue-router";
import { getDocTitle } from "../lib/doc.js";
import { formatDateTime, formatStatusLabel, formatStatusType } from "../lib/format.js";
import AgentChat from "../components/AgentChat.vue";
import DocEditor from "../components/DocEditor.vue";
import { useDocumentStore } from "../stores/document.js";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const docStore = useDocumentStore();

const rendering = ref(false);
const docError = ref<string | null>(null);
let abortRenderController: AbortController | null = null;

const docId = computed(() => String(route.params["id"] ?? ""));
const docContent = computed<Doc | null>(() => docStore.currentDoc?.content ?? null);
const docTitle = computed(() => getDocTitle(docContent.value));
const docStatus = computed(() => docStore.currentDoc?.status ?? "DRAFT");
const updatedAtLabel = computed(() => formatDateTime(docStore.currentDoc?.updatedAt));

watch(docId, () => {
  if (!isValidDocId(docId.value)) {
    docError.value = "无效的文档 ID";
    return;
  }

  void fetchDocument();
}, { immediate: true });

onUnmounted(() => {
  abortRenderController?.abort();
});

function isValidDocId(id: string): boolean {
  return id.length > 0 && id !== "undefined" && id !== "null";
}

async function fetchDocument(): Promise<void> {
  docError.value = null;
  try {
    await docStore.fetchDoc(docId.value);
  } catch (err) {
    docError.value = err instanceof Error ? err.message : "文档加载失败";
  }
}

function reloadDocument(): void {
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
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${docTitle.value}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
    message.success("Word 文件已开始下载");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return;
    }
    message.error(err instanceof Error ? err.message : "导出失败");
  } finally {
    rendering.value = false;
    abortRenderController = null;
  }
}
</script>
