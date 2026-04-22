<template>
  <section class="apple-panel apple-panel-soft" style="padding: 20px 24px;">
    <h3 style="margin: 0 0 14px; text-align: center;">
      {{ title }}
    </h3>

    <div v-if="node.content.length > 0" style="display: grid; gap: 10px;">
      <p
        v-for="paragraph in node.content"
        :key="paragraph.id"
        style="margin: 0; line-height: 1.85; text-indent: 2em;"
      >
        {{ inlineNodesToText(paragraph.content) || "（空摘要段落）" }}
      </p>
    </div>

    <p v-else class="apple-muted">摘要内容为空。</p>

    <p v-if="node.attrs.keywords.length > 0" class="apple-caption" style="text-align: left;">
      <strong>关键词：</strong>{{ node.attrs.keywords.join("；") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Abstract } from "@black-bean-sprouts/doc-schema";
import { inlineNodesToText } from "../../lib/doc.js";

const props = defineProps<{ node: Abstract }>();

const title = computed(() => (
  props.node.attrs.language === "en" ? "Abstract" : "摘要"
));
</script>
