<script setup lang="ts">
import { h, type VNode } from "vue";
import SectionRenderer from "./renderers/SectionRenderer.vue";
import ParagraphRenderer from "./renderers/ParagraphRenderer.vue";
import FigureRenderer from "./renderers/FigureRenderer.vue";
import TableRenderer from "./renderers/TableRenderer.vue";
import FormulaRenderer from "./renderers/FormulaRenderer.vue";
import AbstractRenderer from "./renderers/AbstractRenderer.vue";
import type { BlockNode, BaseNode } from "./renderers/types";
import { isSectionNode, isParagraphNode, isFigureNode, isTableNode, isFormulaNode, isAbstractNode } from "./renderers/types";

const props = defineProps<{ node: BlockNode }>();

function renderBlock(): VNode {
  const node = props.node;
  if (isSectionNode(node)) {
    return h(SectionRenderer, { node });
  }
  if (isParagraphNode(node)) {
    return h(ParagraphRenderer, { node });
  }
  if (isFigureNode(node)) {
    return h(FigureRenderer, { node });
  }
  if (isTableNode(node)) {
    return h(TableRenderer, { node });
  }
  if (isFormulaNode(node)) {
    return h(FormulaRenderer, { node });
  }
  if (isAbstractNode(node)) {
    return h(AbstractRenderer, { node });
  }
  const baseNode: BaseNode = node;
  return h("p", { class: "unsupported" }, `[${baseNode.type}]`);
}

defineExpose({ renderBlock });
</script>

<template>
  <component :is="renderBlock()" />
</template>

<style scoped>
.unsupported { color: #999; font-style: italic; padding: 8px; }
</style>
