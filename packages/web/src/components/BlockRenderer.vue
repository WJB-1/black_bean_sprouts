<template>
  <section-renderer v-if="isSection(node)" :node="node" />
  <paragraph-renderer v-else-if="isParagraph(node)" :node="node" />
  <figure-renderer v-else-if="isFigure(node)" :node="node" />
  <table-renderer v-else-if="isTable(node)" :node="node" />
  <formula-renderer v-else-if="isFormula(node)" :node="node" />
  <abstract-renderer v-else-if="isAbstract(node)" :node="node" />
  <div v-else class="apple-panel apple-panel-soft" style="padding: 16px 18px;">
    <p class="apple-muted">暂不支持预览的区块类型：{{ node.type }}</p>
  </div>
</template>

<script setup lang="ts">
import type {
  Abstract,
  BlockNode,
  Figure,
  Formula,
  Paragraph,
  Section,
  Table,
} from "@black-bean-sprouts/doc-schema";
import AbstractRenderer from "./renderers/AbstractRenderer.vue";
import FigureRenderer from "./renderers/FigureRenderer.vue";
import FormulaRenderer from "./renderers/FormulaRenderer.vue";
import ParagraphRenderer from "./renderers/ParagraphRenderer.vue";
import SectionRenderer from "./renderers/SectionRenderer.vue";
import TableRenderer from "./renderers/TableRenderer.vue";

defineProps<{ node: BlockNode }>();

function isSection(node: BlockNode): node is Section {
  return node.type === "section";
}

function isParagraph(node: BlockNode): node is Paragraph {
  return node.type === "paragraph";
}

function isFigure(node: BlockNode): node is Figure {
  return node.type === "figure";
}

function isTable(node: BlockNode): node is Table {
  return node.type === "table";
}

function isFormula(node: BlockNode): node is Formula {
  return node.type === "formula";
}

function isAbstract(node: BlockNode): node is Abstract {
  return node.type === "abstract";
}
</script>
