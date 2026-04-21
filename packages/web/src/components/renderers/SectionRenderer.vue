<template>
  <section class="section-block">
    <component :is="headingTag">{{ node.attrs?.title ?? "未命名章节" }}</component>
    <template v-if="safeContent && safeContent.length > 0">
      <template v-for="(child, index) in safeContent" :key="child.id ?? index">
        <section-renderer v-if="child.type === 'section'" :node="child as unknown as SectionNode" />
        <paragraph-renderer v-else-if="child.type === 'paragraph'" :node="child as unknown as ParagraphNode" />
        <figure-renderer v-else-if="child.type === 'figure'" :node="child as unknown as import('./types').FigureNode" />
        <table-renderer v-else-if="child.type === 'table'" :node="child as unknown as import('./types').TableNode" />
        <formula-renderer v-else-if="child.type === 'formula'" :node="child as unknown as import('./types').FormulaNode" />
        <abstract-renderer v-else-if="child.type === 'abstract'" :node="child as unknown as import('./types').AbstractNode" />
        <p v-else class="unsupported">[未知类型: {{ child.type }}]</p>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ParagraphRenderer from "./ParagraphRenderer.vue";
import SectionRenderer from "./SectionRenderer.vue";
import FigureRenderer from "./FigureRenderer.vue";
import TableRenderer from "./TableRenderer.vue";
import FormulaRenderer from "./FormulaRenderer.vue";
import AbstractRenderer from "./AbstractRenderer.vue";
import type { ChildNode, SectionNode, ParagraphNode } from "./types";

defineOptions({ name: "SectionRenderer" });

const props = defineProps<{ node: SectionNode }>();

// Safely get content, handling undefined and null cases
const safeContent = computed(() => {
  const content = props.node.content;
  if (!content) return [];
  if (!Array.isArray(content)) {
    console.warn("SectionRenderer: content is not an array", content);
    return [];
  }
  // Prevent infinite loops by limiting recursion depth
  const MAX_DEPTH = 50;
  const checkDepth = (nodes: unknown[], depth = 0): boolean => {
    if (depth > MAX_DEPTH) return false;
    for (const node of nodes) {
      if (typeof node === "object" && node !== null && "type" in node) {
        if ((node as ChildNode).type === "section" && "content" in node) {
          const children = (node as ChildNode).content;
          if (Array.isArray(children) && children.length > 0) {
            if (!checkDepth(children, depth + 1)) return false;
          }
        }
      }
    }
    return true;
  };

  if (!checkDepth(content)) {
    console.error("SectionRenderer: maximum recursion depth exceeded");
    return [];
  }
  return content;
});

const headingTag = computed(() => {
  const level = props.node.attrs?.level ?? 1;
  return `h${Math.min(Math.max(level, 1), 6)}` as const;
});
</script>

<style scoped>
.section-block {
  margin: 16px 0;
}
h1, h2, h3, h4, h5, h6 {
  margin: 24px 0 12px;
  font-weight: 600;
}
.unsupported {
  color: #999;
  font-style: italic;
  padding: 8px;
  background: #fff3cd;
  border-radius: 4px;
}
</style>
