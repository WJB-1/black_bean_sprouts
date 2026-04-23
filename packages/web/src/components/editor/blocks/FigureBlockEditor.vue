<template>
  <div class="figure-block-editor">
    <div class="figure-block-image-area">
      <div v-if="!block.src" class="figure-block-placeholder" @click="onImageAreaClick">
        <span class="figure-block-placeholder-icon">&#9638;</span>
        <span class="figure-block-placeholder-text">Click to add image</span>
      </div>
      <img
        v-else
        :src="block.src"
        :alt="block.alt || ''"
        class="figure-block-image"
        :style="imageStyle"
      />
    </div>

    <div class="figure-block-controls">
      <label class="figure-block-control">
        <span class="figure-block-control-label">Alt</span>
        <input
          class="figure-block-control-input"
          type="text"
          :value="block.alt || ''"
          placeholder="Image description"
          @input="onAltChange"
        />
      </label>
      <label class="figure-block-control">
        <span class="figure-block-control-label">W</span>
        <input
          class="figure-block-control-input figure-block-control-input--num"
          type="number"
          :value="block.width ?? ''"
          placeholder="auto"
          min="0"
          @input="onWidthChange"
        />
      </label>
      <label class="figure-block-control">
        <span class="figure-block-control-label">H</span>
        <input
          class="figure-block-control-input figure-block-control-input--num"
          type="number"
          :value="block.height ?? ''"
          placeholder="auto"
          min="0"
          @input="onHeightChange"
        />
      </label>
      <label class="figure-block-control">
        <span class="figure-block-control-label">Src</span>
        <input
          class="figure-block-control-input"
          type="text"
          :value="block.src"
          placeholder="Image URL"
          @input="onSrcChange"
        />
      </label>
    </div>

    <div class="figure-block-caption" contenteditable="true" @blur="onCaptionBlur">
      {{ captionText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { FigureBlock, InlineNode, DocumentPatch } from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: FigureBlock;
}>();

const emit = defineEmits<{
  (e: "patch", patches: readonly DocumentPatch[]): void;
}>();

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

const captionText = computed(() =>
  inlineNodesToPlainText(props.block.caption),
);

const imageStyle = computed(() => ({
  maxWidth: props.block.width ? `${props.block.width}px` : "100%",
  height: props.block.height ? `${props.block.height}px` : "auto",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inlineNodesToPlainText(nodes: readonly InlineNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => (n.type === "text" ? n.text : ""))
    .join("");
}

function makeCaptionInlines(text: string): readonly InlineNode[] {
  if (!text) return [];
  return [{ type: "text", text }];
}

function replacePatch(overrides: Partial<FigureBlock>): void {
  emit("patch", [
    {
      op: "replace",
      blockId: props.block.id,
      block: { ...props.block, ...overrides },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onImageAreaClick() {
  const src = prompt("Enter image URL:");
  if (src !== null && src.trim() !== "") {
    replacePatch({ src: src.trim() });
  }
}

function onSrcChange(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  replacePatch({ src: value });
}

function onAltChange(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  replacePatch({ alt: value });
}

function onWidthChange(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const width = raw === "" ? undefined : Number(raw);
  replacePatch({ width });
}

function onHeightChange(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const height = raw === "" ? undefined : Number(raw);
  replacePatch({ height });
}

function onCaptionBlur(event: Event) {
  const text = (event.target as HTMLElement).textContent ?? "";
  const newCaption = makeCaptionInlines(text);
  if (inlineNodesToPlainText(props.block.caption) !== text) {
    replacePatch({ caption: newCaption });
  }
}
</script>

<style scoped>
.figure-block-editor {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
  margin: 8px 0;
}

.figure-block-image-area {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  margin-bottom: 8px;
}

.figure-block-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 120px;
  background: #f0f0f0;
  border: 2px dashed #ccc;
  border-radius: 4px;
  cursor: pointer;
  color: #888;
  transition: border-color 0.2s, color 0.2s;
}

.figure-block-placeholder:hover {
  border-color: #4a90d9;
  color: #4a90d9;
}

.figure-block-placeholder-icon {
  font-size: 32px;
}

.figure-block-placeholder-text {
  font-size: 13px;
}

.figure-block-image {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.figure-block-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.figure-block-control {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.figure-block-control-label {
  font-weight: 600;
  min-width: 20px;
}

.figure-block-control-input {
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 12px;
  outline: none;
  width: 120px;
}

.figure-block-control-input--num {
  width: 60px;
}

.figure-block-control-input:focus {
  border-color: #4a90d9;
}

.figure-block-caption {
  border-top: 1px solid #e0e0e0;
  padding-top: 8px;
  font-size: 13px;
  color: #555;
  outline: none;
  min-height: 20px;
}

.figure-block-caption:empty::before {
  content: "Add a caption...";
  color: #bbb;
}
</style>
