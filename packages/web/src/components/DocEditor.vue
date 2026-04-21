<template>
  <div class="doc-editor" v-if="doc">
    <h1>{{ docTitle }}</h1>
    <n-spin :show="loading">
      <template v-if="content.length === 0">
        <n-empty description="文档为空，让 Agent 开始写作吧" style="margin-top: 40px">
          <template #extra>
            <n-text depth="3" style="font-size: 12px">
              在右侧 Agent 助手面板输入指令开始创作
            </n-text>
          </template>
        </n-empty>
      </template>
      <template v-else>
        <block-renderer v-for="node in content" :key="node.id" :node="node" />
      </template>
    </n-spin>
  </div>
  <div v-else class="doc-editor-placeholder">
    <n-empty description="未加载文档" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NEmpty, NSpin, NText } from "naive-ui";
import BlockRenderer from "./BlockRenderer.vue";
import type { BlockNode } from "./renderers/types";

const props = defineProps<{
  doc: Record<string, unknown> | null;
}>();

const loading = ref(false);

const docTitle = computed(() => {
  if (!props.doc) return "未命名文档";
  const attrs = props.doc["attrs"] as Record<string, unknown> | undefined;
  return (attrs?.["title"] as string) ?? "未命名文档";
});

const content = computed((): BlockNode[] => {
  if (!props.doc) return [];
  const content = props.doc["content"];
  if (!content) return [];
  if (!Array.isArray(content)) {
    console.warn("DocEditor: content is not an array", content);
    return [];
  }
  return content as BlockNode[];
});
</script>

<style scoped>
.doc-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  background: white;
  min-height: 100vh;
  box-shadow: 0 0 20px rgba(0,0,0,0.05);
}
.doc-editor-placeholder {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  background: white;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
h1 { text-align: center; margin-bottom: 24px; }
.unsupported { color: #999; font-style: italic; padding: 8px; }
</style>
