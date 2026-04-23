<template>
  <div class="heading-block-editor" :class="levelClass">
    <div
      class="heading-block-content"
      contenteditable="true"
      @blur="onBlur"
    >{{ textContent }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HeadingBlock, InlineNode, DocumentPatch } from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: HeadingBlock;
}>();

const emit = defineEmits<{
  (e: "patch", patches: readonly DocumentPatch[]): void;
}>();

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

const textContent = computed(() =>
  props.block.children
    .filter((n): n is InlineNode & { type: "text" } => n.type === "text")
    .map((n) => n.text)
    .join(""),
);

const levelClass = computed(() => `heading-block-editor--h${props.block.level}`);

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onBlur(event: Event): void {
  const text = (event.target as HTMLElement).textContent ?? "";
  if (textContent.value !== text) {
    emit("patch", [
      {
        op: "replace",
        blockId: props.block.id,
        block: {
          ...props.block,
          children: text ? [{ type: "text", text } as const] : [],
        },
      },
    ]);
  }
}
</script>

<style scoped>
.heading-block-editor {
  margin: 8px 0 4px;
}

.heading-block-content {
  outline: none;
  font-weight: 700;
  line-height: 1.3;
}

.heading-block-content:empty::before {
  content: "Heading...";
  color: #bbb;
}

.heading-block-editor--h1 .heading-block-content { font-size: 24px; }
.heading-block-editor--h2 .heading-block-content { font-size: 20px; }
.heading-block-editor--h3 .heading-block-content { font-size: 17px; }
.heading-block-editor--h4 .heading-block-content { font-size: 15px; }
.heading-block-editor--h5 .heading-block-content { font-size: 14px; }
.heading-block-editor--h6 .heading-block-content { font-size: 13px; }
</style>
