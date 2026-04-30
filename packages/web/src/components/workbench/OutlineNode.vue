<template>
  <div class="outline-node">
    <div
      class="outline-row"
      :class="`outline-row--${block.type}`"
      :style="{ paddingLeft: `${depth * 16}px` }"
      @click="toggleExpand"
    >
      <span v-if="hasChildren" class="outline-toggle">{{ isExpanded ? '▼' : '▶' }}</span>
      <span v-else class="outline-toggle outline-toggle--placeholder"></span>

      <span class="outline-icon">{{ iconFor(block.type) }}</span>
      <span class="outline-text">{{ displayText }}</span>
      <span v-if="childCount > 0" class="outline-count">{{ childCount }}</span>
    </div>

    <div v-if="hasChildren && isExpanded" class="outline-children">
      <OutlineNode
        v-for="child in children"
        :key="child.id"
        :block="child"
        :depth="depth + 1"
        :expand-all="expandAll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BlockNode } from "@black-bean-sprouts/doc-schema";

const props = defineProps<{
  block: BlockNode;
  depth?: number;
  expandAll?: boolean;
}>();

const depth = computed(() => props.depth ?? 0);

const isExpanded = ref(props.expandAll ?? true);

watch(
  () => props.expandAll,
  (val) => {
    isExpanded.value = val ?? true;
  },
);

const hasChildren = computed(() => {
  if (props.block.type === "section") {
    return props.block.children.length > 0;
  }
  if (props.block.type === "abstract") {
    return props.block.children.length > 0;
  }
  if (props.block.type === "reference-list") {
    return props.block.items.length > 0;
  }
  return false;
});

const children = computed(() => {
  if (props.block.type === "section") {
    return props.block.children;
  }
  if (props.block.type === "abstract") {
    return props.block.children;
  }
  return [];
});

const childCount = computed(() => {
  if (props.block.type === "section") {
    return props.block.children.length;
  }
  if (props.block.type === "abstract") {
    return props.block.children.length;
  }
  if (props.block.type === "reference-list") {
    return props.block.items.length;
  }
  if (props.block.type === "table") {
    return props.block.rows.length;
  }
  return 0;
});

const displayText = computed(() => {
  const b = props.block;
  switch (b.type) {
    case "heading":
      return inlineText(b.children);
    case "paragraph":
      return truncate(inlineText(b.children), 60);
    case "section":
      return b.title;
    case "abstract":
      return "摘要";
    case "formula":
      return truncate(b.latex, 40);
    case "table":
      return `表格 (${b.rows.length} 行)`;
    case "figure":
      return b.alt || b.src || "图片";
    case "reference-list":
      return `参考文献 (${b.items.length} 条)`;
  }
});

function toggleExpand() {
  if (hasChildren.value) {
    isExpanded.value = !isExpanded.value;
  }
}

function iconFor(type: string): string {
  switch (type) {
    case "heading": return "H";
    case "paragraph": return "¶";
    case "section": return "§";
    case "abstract": return "📝";
    case "formula": return "∑";
    case "table": return "▦";
    case "figure": return "🖼️";
    case "reference-list": return "📚";
    default: return "•";
  }
}

function inlineText(children: readonly { type: string; text?: string; latex?: string }[]): string {
  return children
    .map((item) => {
      if (item.type === "text") return item.text ?? "";
      if (item.type === "formula-inline") return item.latex ?? "";
      if (item.type === "hardBreak") return " ";
      return "";
    })
    .join("")
    .trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) + "…" : value;
}
</script>

<style scoped>
.outline-node {
  user-select: none;
}

.outline-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
  line-height: 1.5;
}

.outline-row:hover {
  background: var(--color-primary-soft);
}

.outline-row--heading {
  font-weight: 600;
  color: var(--color-text);
}

.outline-row--section {
  font-weight: 600;
  color: var(--color-primary);
}

.outline-toggle {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
  font-size: 10px;
  color: var(--color-text-muted);
}

.outline-toggle--placeholder {
  opacity: 0;
}

.outline-icon {
  flex-shrink: 0;
  width: 18px;
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
}

.outline-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-count {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--color-surface-elevated);
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
