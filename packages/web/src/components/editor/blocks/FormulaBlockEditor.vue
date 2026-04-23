<template>
  <div class="formula-block-editor">
    <div v-if="!editing" class="formula-block-display" @click="startEditing">
      <pre v-if="block.latex" class="formula-block-latex">{{ block.latex }}</pre>
      <div v-else class="formula-block-placeholder">
        Click to add LaTeX formula
      </div>
    </div>
    <div v-else class="formula-block-edit">
      <textarea
        ref="latexInput"
        v-model="latexDraft"
        class="formula-block-textarea"
        placeholder="Enter LaTeX, e.g. E = mc^2"
        rows="4"
        @keydown.escape.prevent="cancelEditing"
        @keydown.ctrl.enter.prevent="commitEditing"
      />
      <div class="formula-block-edit-actions">
        <button class="formula-block-btn" @click="commitEditing">
          Done (Ctrl+Enter)
        </button>
        <button class="formula-block-btn formula-block-btn--secondary" @click="cancelEditing">
          Cancel (Esc)
        </button>
      </div>
    </div>

    <div class="formula-block-caption" contenteditable="true" @blur="onCaptionBlur">
      {{ captionText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import type { FormulaBlock, InlineNode, DocumentPatch } from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: FormulaBlock;
}>();

const emit = defineEmits<{
  (e: "patch", patches: readonly DocumentPatch[]): void;
}>();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const editing = ref(false);
const latexDraft = ref("");
const latexInput = ref<HTMLTextAreaElement | null>(null);

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

const captionText = computed(() =>
  inlineNodesToPlainText(props.block.caption),
);

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

function replacePatch(overrides: Partial<FormulaBlock>): void {
  emit("patch", [
    {
      op: "replace",
      blockId: props.block.id,
      block: { ...props.block, ...overrides },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

function startEditing(): void {
  editing.value = true;
  latexDraft.value = props.block.latex;
  nextTick(() => {
    latexInput.value?.focus();
  });
}

function commitEditing(): void {
  editing.value = false;
  if (latexDraft.value !== props.block.latex) {
    replacePatch({ latex: latexDraft.value });
  }
}

function cancelEditing(): void {
  editing.value = false;
  latexDraft.value = props.block.latex;
}

// ---------------------------------------------------------------------------
// Caption
// ---------------------------------------------------------------------------

function onCaptionBlur(event: Event): void {
  const text = (event.target as HTMLElement).textContent ?? "";
  if (inlineNodesToPlainText(props.block.caption) !== text) {
    replacePatch({ caption: makeCaptionInlines(text) });
  }
}
</script>

<style scoped>
.formula-block-editor {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
  margin: 8px 0;
}

.formula-block-display {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
}

.formula-block-display:hover {
  border-color: #4a90d9;
}

.formula-block-latex {
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace;
  font-size: 16px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #333;
}

.formula-block-placeholder {
  color: #bbb;
  font-size: 14px;
}

.formula-block-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.formula-block-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace;
  font-size: 14px;
  resize: vertical;
  outline: none;
  line-height: 1.5;
}

.formula-block-textarea:focus {
  border-color: #4a90d9;
}

.formula-block-edit-actions {
  display: flex;
  gap: 8px;
}

.formula-block-btn {
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.formula-block-btn:hover {
  background: #3a7bc8;
}

.formula-block-btn--secondary {
  background: #f5f5f5;
  color: #555;
  border: 1px solid #ddd;
}

.formula-block-btn--secondary:hover {
  background: #eee;
}

.formula-block-caption {
  border-top: 1px solid #e0e0e0;
  margin-top: 8px;
  padding-top: 8px;
  font-size: 13px;
  color: #555;
  outline: none;
  min-height: 20px;
}

.formula-block-caption:empty::before {
  content: "Add a caption...";
  color: #bbb;
}
</style>
