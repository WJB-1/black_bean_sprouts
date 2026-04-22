<template>
  <figure class="apple-figure">
    <div class="apple-figure-placeholder">
      <div style="text-align: center;">
        <strong>{{ assetLabel }}</strong>
        <p class="apple-muted" style="margin: 8px 0 0;">
          {{ node.attrs.layout === "single" ? "单图布局" : `布局：${node.attrs.layout}` }}
        </p>
      </div>
    </div>
    <figcaption class="apple-caption">
      {{ node.attrs.caption || "未填写图题" }}
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Figure } from "@black-bean-sprouts/doc-schema";

const props = defineProps<{ node: Figure }>();

const assetLabel = computed(() => {
  if (props.node.attrs.asset?.assetId) {
    return `资源：${props.node.attrs.asset.assetId}`;
  }

  if (props.node.attrs.subfigures?.length) {
    return `子图数量：${props.node.attrs.subfigures.length}`;
  }

  return "图像资源待补充";
});
</script>
