<template>
  <div class="abstract-block-editor">
    <div class="abstract-block-header">
      <span class="abstract-block-header-label">Abstract</span>
      <button class="abstract-block-btn" @click="onAddParagraph">+ Paragraph</button>
    </div>
    <div class="abstract-block-body">
      <div
        v-for="(para, idx) in block.children"
        :key="para.id"
        class="abstract-block-paragraph"
      >
        <div
          class="abstract-block-paragraph-content"
          contenteditable="true"
          @blur="(e) => onParagraphBlur(idx, e)"
        >{{ paragraphText(para) }}</div>
        <button
          v-if="block.children.length > 1"
          class="abstract-block-remove-btn"
          title="Remove paragraph"
          @click="onRemoveParagraph(idx)"
        >&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AbstractBlock, ParagraphBlock, InlineNode, DocumentPatch } from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: AbstractBlock;
}>();

const emit = defineEmits<{
  (e: "patch", patches: readonly DocumentPatch[]): void;
}>();

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paragraphText(para: ParagraphBlock): string {
  return para.children
    .filter((n): n is InlineNode & { type: "text" } => n.type === "text")
    .map((n) => n.text)
    .join("");
}

function makeParagraph(text: string): ParagraphBlock {
  return {
    type: "paragraph",
    id: genId("p"),
    children: text ? [{ type: "text", text }] : [],
  };
}

function replacePatch(children: readonly ParagraphBlock[]): void {
  emit("patch", [
    {
      op: "replace",
      blockId: props.block.id,
      block: { ...props.block, children },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onParagraphBlur(index: number, event: Event): void {
  const text = (event.target as HTMLElement).textContent ?? "";
  const current = props.block.children[index];
  if (!current) return;
  if (paragraphText(current) !== text) {
    const updated = [...props.block.children];
    updated[index] = makeParagraph(text);
    replacePatch(updated);
  }
}

function onAddParagraph(): void {
  const updated = [...props.block.children, makeParagraph("")];
  replacePatch(updated);
}

function onRemoveParagraph(index: number): void {
  if (props.block.children.length <= 1) return;
  const updated = [...props.block.children];
  updated.splice(index, 1);
  replacePatch(updated);
}
</script>

<style scoped>
.abstract-block-editor {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0;
  background: #f8f9fa;
  margin: 12px 0;
}

.abstract-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #d0d7de;
  background: #eef1f4;
  border-radius: 6px 6px 0 0;
}

.abstract-block-header-label {
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #444;
}

.abstract-block-btn {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.abstract-block-btn:hover {
  background: #f0f4ff;
}

.abstract-block-body {
  padding: 8px 12px;
}

.abstract-block-paragraph {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 4px;
}

.abstract-block-paragraph-content {
  flex: 1;
  padding: 6px 8px;
  min-height: 24px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  border-radius: 3px;
  transition: background 0.15s;
}

.abstract-block-paragraph-content:focus {
  background: #fff;
}

.abstract-block-paragraph-content:empty::before {
  content: "Write paragraph...";
  color: #bbb;
}

.abstract-block-remove-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #c44;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s;
}

.abstract-block-paragraph:hover .abstract-block-remove-btn {
  opacity: 1;
}

.abstract-block-remove-btn:hover {
  color: #a22;
}
</style>
