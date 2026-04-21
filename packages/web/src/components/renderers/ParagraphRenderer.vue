<template>
  <p><span v-for="(inline, i) in content" :key="i">{{ inline.text }}</span></p>
</template>

<script setup lang="ts">
import type { ParagraphNode } from "./types";

const props = defineProps<{ node: ParagraphNode }>();

const content = props.node.content ?? [];
</script>

<style scoped>
p { text-indent: 2em; line-height: 1.8; margin: 6px 0; }
</style>
