<template>
  <section class="apple-editor-shell">
    <div class="apple-editor-column">
      <section class="apple-editor-pane apple-meta-card">
        <header class="apple-subpanel-header">
          <div>
            <p class="apple-kicker">Document Meta</p>
            <h2 class="apple-section-title">标题与基础信息</h2>
          </div>
          <n-button type="primary" size="small" @click="saveMeta">保存信息</n-button>
        </header>

        <div class="apple-meta-grid">
          <n-input v-model:value="title" placeholder="文档标题" />
          <n-select v-model:value="language" :options="languageOptions" />
          <n-input v-model:value="subtitle" placeholder="副标题（可留空）" />
          <n-input v-model:value="institution" placeholder="院校 / 机构（可留空）" />
          <n-input v-model:value="keywords" placeholder="关键词，逗号分隔" />
        </div>
      </section>

      <block-tree-editor :blocks="doc?.content ?? []" @apply="applyPatches" />
    </div>

    <section class="apple-editor-pane apple-preview-pane">
      <header class="apple-subpanel-header">
        <div>
          <p class="apple-kicker">Live Preview</p>
          <h2 class="apple-section-title">实时文稿视图</h2>
        </div>
      </header>
      <div class="apple-preview-scroll">
        <doc-editor :doc="doc" />
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import type { Doc, DocumentPatch } from "@black-bean-sprouts/doc-schema";
import { ref, watch } from "vue";
import { useMessage } from "naive-ui";
import { textToKeywords } from "../../lib/doc-editor.js";
import BlockTreeEditor from "./BlockTreeEditor.vue";
import DocEditor from "../DocEditor.vue";
import { useDocumentStore } from "../../stores/document.js";

const props = defineProps<{
  documentId: string;
  doc: Doc | null;
}>();

const emit = defineEmits<{ patched: [] }>();

const docStore = useDocumentStore();
const message = useMessage();

const title = ref("");
const subtitle = ref("");
const institution = ref("");
const keywords = ref("");
const language = ref<"zh" | "en">("zh");

const languageOptions = [
  { label: "中文", value: "zh" as const },
  { label: "English", value: "en" as const },
];

watch(() => props.doc, syncMetaDrafts, { immediate: true, deep: true });

async function applyPatches(patches: DocumentPatch[]): Promise<void> {
  try {
    await docStore.applyPatches(props.documentId, patches);
    emit("patched");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "补丁应用失败");
  }
}

async function saveMeta(): Promise<void> {
  await applyPatches([{
    op: "update_meta",
    meta: {
      title: title.value.trim() || "未命名文档",
      subtitle: subtitle.value.trim() || null,
      institution: institution.value.trim() || null,
      docLanguage: language.value,
      keywords: textToKeywords(keywords.value),
    },
  }]);
}

function syncMetaDrafts(): void {
  title.value = props.doc?.attrs.title ?? "";
  subtitle.value = props.doc?.attrs.subtitle ?? "";
  institution.value = props.doc?.attrs.institution ?? "";
  keywords.value = props.doc?.attrs.keywords?.join(", ") ?? "";
  language.value = props.doc?.attrs.docLanguage ?? "zh";
}
</script>
