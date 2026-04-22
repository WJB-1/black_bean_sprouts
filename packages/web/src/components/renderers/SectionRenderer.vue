<template>
  <section>
    <component :is="headingTag" :style="headingStyle">
      {{ node.attrs.title || "未命名章节" }}
    </component>

    <p v-if="node.attrs.label" class="apple-muted" style="margin: 6px 0 14px;">
      锚点：{{ node.attrs.label }}
    </p>

    <div style="display: grid; gap: 14px;">
      <block-renderer
        v-for="child in node.content"
        :key="child.id"
        :node="child"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import { computed } from "vue";
import type { Section } from "@black-bean-sprouts/doc-schema";
import BlockRenderer from "../BlockRenderer.vue";

defineOptions({ name: "SectionRenderer" });

const props = defineProps<{ node: Section }>();

const headingTag = computed(() => `h${Math.min(Math.max(props.node.attrs.level, 1), 6)}`);
const headingStyle = computed<CSSProperties>(() => {
  const sizeMap: Record<number, string> = {
    1: "34px",
    2: "28px",
    3: "22px",
    4: "18px",
    5: "16px",
  };

  return {
    margin: "30px 0 14px",
    fontSize: sizeMap[props.node.attrs.level] ?? "18px",
    lineHeight: "1.2",
    fontWeight: "700",
  };
});
</script>
