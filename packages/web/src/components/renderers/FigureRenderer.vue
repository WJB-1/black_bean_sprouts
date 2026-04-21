<template>
  <figure>
    <div class="placeholder">[图片: {{ assetId }}]</div>
    <figcaption>{{ caption }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
import type { FigureNode } from "./types";

const props = defineProps<{ node: FigureNode }>();

const assetId = props.node.attrs?.asset?.assetId ?? "subfigures";
const caption = props.node.attrs?.caption ?? "";
</script>

<style scoped>
figure { text-align: center; margin: 16px 0; }
.placeholder { background: #f0f0f0; padding: 40px; border-radius: 4px; color: #999; }
figcaption { font-size: 14px; color: #666; margin-top: 8px; }
</style>
