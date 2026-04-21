<template>
  <div class="abstract">
    <h3>{{ title }}</h3>
    <template v-if="safeContent.length > 0">
      <template v-for="(para, i) in safeContent" :key="getParaKey(para, i)">
        <p v-for="(inline, j) in safeInlineContent(para.content ?? [])" :key="j">
          {{ inline.text ?? "" }}
        </p>
      </template>
    </template>
    <p v-else class="empty-abstract">[摘要内容为空]</p>
    <p v-if="keywordsText" class="keywords"><strong>关键词:</strong> {{ keywordsText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AbstractNode } from "./types";

const props = defineProps<{ node: AbstractNode }>();

const title = computed(() => {
  const language = props.node.attrs?.language;
  return language === "en" ? "Abstract" : "摘要";
});

const keywordsText = computed(() => {
  const keywords = props.node.attrs?.keywords;
  if (!keywords) return "";
  if (!Array.isArray(keywords)) {
    console.warn("AbstractRenderer: keywords is not an array", keywords);
    return "";
  }
  return keywords.join("; ");
});

const safeContent = computed(() => {
  const content = props.node.content;
  if (!content) return [];
  if (!Array.isArray(content)) {
    console.warn("AbstractRenderer: content is not an array", content);
    return [];
  }
  return content;
});

function getParaKey(para: Record<string, unknown>, index: number): string | number {
  const id = para["id"] as string | undefined;
  return id ?? index;
}

function safeInlineContent(content: unknown[]): Array<{ text?: string }> {
  if (!Array.isArray(content)) return [];
  return content as Array<{ text?: string }>;
}
</script>

<style scoped>
.abstract {
  margin: 16px 0;
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
}
h3 {
  text-align: center;
  margin-bottom: 12px;
}
.abstract p {
  text-indent: 2em;
  line-height: 1.8;
  margin: 6px 0;
}
.keywords {
  font-size: 14px;
  margin-top: 12px;
  text-indent: 0;
}
.empty-abstract {
  color: #999;
  font-style: italic;
  text-align: center;
  text-indent: 0;
}
</style>
