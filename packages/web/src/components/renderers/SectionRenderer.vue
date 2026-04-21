<template>
  <component :is="headingTag">{{ node.attrs?.title }}</component>
  <template v-for="child in node.content" :key="child.id">
    <section-renderer v-if="child.type === 'section'" :node="child as unknown as SectionNode" />
    <paragraph-renderer v-else-if="child.type === 'paragraph'" :node="child as unknown as ParagraphNode" />
    <p v-else class="unsupported">[{{ child.type }}]</p>
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ParagraphRenderer from "./ParagraphRenderer.vue";
import type { ChildNode, SectionNode, ParagraphNode } from "./types";

defineOptions({ name: "SectionRenderer" });

const props = defineProps<{ node: SectionNode }>();

const headingTag = computed(() => `h${Math.min((props.node.attrs?.level ?? 1), 6)}`);
</script>

<style scoped>
h1, h2, h3, h4, h5, h6 { margin: 24px 0 12px; }
.unsupported { color: #999; font-style: italic; padding: 8px; }
</style>
