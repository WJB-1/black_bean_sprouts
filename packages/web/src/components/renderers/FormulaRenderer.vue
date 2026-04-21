<template>
  <div class="formula">{{ latex }}</div>
</template>

<script setup lang="ts">
import type { FormulaNode } from "./types";

const props = defineProps<{ node: FormulaNode }>();

const latex = props.node.attrs?.latex ?? "";
</script>

<style scoped>
.formula { text-align: center; font-family: 'Cambria Math', serif; font-style: italic; padding: 12px; margin: 8px 0; background: #fafafa; }
</style>
