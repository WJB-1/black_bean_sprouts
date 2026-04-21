<template>
  <figure>
    <div class="placeholder">[图片: {{ safeAssetId }}]</div>
    <figcaption v-if="safeCaption">{{ safeCaption }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { FigureNode } from "./types";

const props = defineProps<{ node: FigureNode }>();

const safeAssetId = computed(() => {
  const asset = props.node.attrs?.asset;
  if (!asset) return "未知";
  if (typeof asset === "object" && asset !== null && "assetId" in asset) {
    return (asset as { assetId?: string }).assetId ?? "subfigures";
  }
  return "未知";
});

const safeCaption = computed(() => {
  const caption = props.node.attrs?.caption;
  return caption && typeof caption === "string" ? caption : "";
});
</script>

<style scoped>
figure { text-align: center; margin: 16px 0; }
.placeholder {
  background: #f0f0f0;
  padding: 40px;
  border-radius: 4px;
  color: #999;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
figcaption {
  font-size: 14px;
  color: #666;
  margin-top: 8px;
}
</style>
