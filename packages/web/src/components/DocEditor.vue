<template>
  <div class="doc-editor" v-if="doc">
    <h1>{{ docTitle }}</h1>
    <block-renderer v-for="node in content" :key="node.id" :node="node" />
    <n-empty v-if="!content.length" description="文档为空，让 Agent 开始写作吧" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NEmpty } from "naive-ui";
import BlockRenderer from "./BlockRenderer.vue";
import type { BlockNode } from "./renderers/types";

const props = defineProps<{
  doc: Record<string, unknown> | null;
}>();

const docTitle = computed(() => {
  const attrs = props.doc?.["attrs"] as Record<string, unknown> | undefined;
  return (attrs?.["title"] as string) ?? "未命名文档";
});

const content = computed((): BlockNode[] => {
  return (props.doc?.["content"] as BlockNode[]) ?? [];
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
h1 { text-align: center; margin-bottom: 24px; }
.unsupported { color: #999; font-style: italic; padding: 8px; }
</style>
