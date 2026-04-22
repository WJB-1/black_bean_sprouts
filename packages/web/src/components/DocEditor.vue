<template>
  <div v-if="doc" style="padding: 28px 24px 36px;">
    <article class="apple-paper">
      <p class="apple-kicker">Preview</p>
      <h1 class="apple-title" style="font-size: clamp(30px, 3vw, 42px);">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="apple-subtitle" style="margin-top: 10px;">
        {{ subtitle }}
      </p>

      <div class="apple-paper-meta">
        <span class="apple-badge">语言：{{ languageLabel }}</span>
        <span v-if="doc.attrs.authors.length > 0" class="apple-badge">
          作者数：{{ doc.attrs.authors.length }}
        </span>
        <span v-if="doc.attrs.keywords?.length" class="apple-badge">
          关键词：{{ doc.attrs.keywords.join(" / ") }}
        </span>
      </div>

      <hr class="apple-divider">

      <section v-if="doc.content.length > 0" style="display: grid; gap: 18px;">
        <block-renderer
          v-for="node in doc.content"
          :key="node.id"
          :node="node"
        />
      </section>

      <section v-else class="apple-empty" style="min-height: 260px;">
        <div>
          <p class="apple-kicker">Empty Document</p>
          <h2 class="apple-section-title">文档还是空的</h2>
          <p class="apple-muted">你可以在右侧对 Agent 说“生成摘要”或“写一个论文目录”。</p>
        </div>
      </section>
    </article>
  </div>

  <div v-else class="apple-empty" style="min-height: 100%;">
    <div>
      <h3 style="margin-top: 0;">暂未加载文档</h3>
      <p class="apple-muted">请返回列表页重新选择文档。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Doc } from "@black-bean-sprouts/doc-schema";
import { computed } from "vue";
import { getDocSubtitle, getDocTitle } from "../lib/doc.js";
import BlockRenderer from "./BlockRenderer.vue";

const props = defineProps<{
  doc: Doc | null;
}>();

const title = computed(() => getDocTitle(props.doc));
const subtitle = computed(() => getDocSubtitle(props.doc));
const languageLabel = computed(() => (
  props.doc?.attrs.docLanguage === "en" ? "English" : "中文"
));
</script>
