<template>
  <div class="paragraph-block-editor">
    <div
      class="paragraph-block-content"
      contenteditable="true"
      @blur="onBlur"
    >{{ textContent }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ParagraphBlock, InlineNode, DocumentPatch } from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: ParagraphBlock;
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
.paragraph-block-editor {
  margin: 4px 0;
}

.paragraph-block-content {
  padding: 4px 0;
  min-height: 24px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
}

.paragraph-block-content:empty::before {
  content: "Type something...";
  color: #bbb;
}
</style>
