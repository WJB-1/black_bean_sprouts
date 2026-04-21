<template>
  <div class="abstract">
    <h3>{{ title }}</h3>
    <template v-for="(para, i) in node.content" :key="i">
      <p v-for="(inline, j) in para.content ?? []" :key="j">{{ inline.text }}</p>
    </template>
    <p class="keywords"><strong>关键词:</strong> {{ keywordsText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AbstractNode } from "./types";

const props = defineProps<{ node: AbstractNode }>();

const title = computed(() => {
  return props.node.attrs?.language === "zh" ? "摘要" : "Abstract";
});

const keywordsText = computed(() => {
  return props.node.attrs?.keywords?.join("; ") ?? "";
});
</script>

<style scoped>
.abstract { margin: 16px 0; padding: 16px; background: #fafafa; }
h3 { text-align: center; }
.keywords { font-size: 14px; margin-top: 8px; }
</style>
