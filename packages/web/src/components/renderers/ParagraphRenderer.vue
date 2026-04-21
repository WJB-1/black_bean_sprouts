<template>
  <p>
    <span v-for="(inline, i) in safeContent" :key="i">{{ inline.text ?? "" }}</span>
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ParagraphNode } from "./types";

const props = defineProps<{ node: ParagraphNode }>();

// Safely get content, handling undefined and null cases
const safeContent = computed(() => {
  const content = props.node.content;
  if (!content) return [];
  if (!Array.isArray(content)) {
    console.warn("ParagraphRenderer: content is not an array", content);
    return [];
  }
  return content;
});
</script>

<style scoped>
p { text-indent: 2em; line-height: 1.8; margin: 6px 0; }
</style>
