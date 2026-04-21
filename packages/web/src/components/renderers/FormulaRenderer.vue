<template>
  <div class="formula">{{ safeLatex }}</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { FormulaNode } from "./types";

const props = defineProps<{ node: FormulaNode }>();

const safeLatex = computed(() => {
  const latex = props.node.attrs?.latex;
  if (!latex) return "";
  if (typeof latex !== "string") {
    console.warn("FormulaRenderer: latex is not a string", latex);
    return "";
  }
  return latex;
});
</script>

<style scoped>
.formula {
  text-align: center;
  font-family: "Cambria Math", serif;
  font-style: italic;
  padding: 12px;
  margin: 8px 0;
  background: #fafafa;
  border-radius: 4px;
  min-height: 24px;
}
.formula:empty::before {
  content: "[公式]";
  color: #999;
  font-style: normal;
}
</style>
