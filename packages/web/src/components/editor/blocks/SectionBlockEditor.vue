<template>
  <div class="section-block-editor" :class="{ 'section-block-editor--collapsed': collapsed }">
    <div class="section-block-title-bar">
      <button class="section-block-toggle" @click="collapsed = !collapsed">
        <span class="section-block-toggle-icon">{{ collapsed ? "\u25B6" : "\u25BC" }}</span>
      </button>
      <input
        class="section-block-title-input"
        type="text"
        :value="block.title"
        placeholder="Section title"
        @blur="onTitleBlur"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      />
    </div>

    <div v-show="!collapsed" class="section-block-children">
      <div
        v-for="(child, idx) in block.children"
        :key="child.id"
        class="section-block-child"
      >
        <FigureBlockEditor
          v-if="child.type === 'figure'"
          :block="child"
          @patch="forwardPatch"
        />
        <TableBlockEditor
          v-else-if="child.type === 'table'"
          :block="child"
          @patch="forwardPatch"
        />
        <FormulaBlockEditor
          v-else-if="child.type === 'formula'"
          :block="child"
          @patch="forwardPatch"
        />
        <AbstractBlockEditor
          v-else-if="child.type === 'abstract'"
          :block="child"
          @patch="forwardPatch"
        />
        <SectionBlockEditor
          v-else-if="child.type === 'section'"
          :block="child"
          @patch="forwardPatch"
        />
        <ReferenceListBlockEditor
          v-else-if="child.type === 'reference-list'"
          :block="child"
          @patch="forwardPatch"
        />
        <ParagraphBlockEditor
          v-else-if="child.type === 'paragraph'"
          :block="child"
          @patch="forwardPatch"
        />
        <HeadingBlockEditor
          v-else-if="child.type === 'heading'"
          :block="child"
          @patch="forwardPatch"
        />
        <div v-else class="section-block-unknown">
          Unknown block type: {{ (child as any).type }}
        </div>

        <button
          class="section-block-remove-child"
          title="Remove block"
          @click="onRemoveChild(idx)"
        >&times;</button>
      </div>

      <div class="section-block-add">
        <button class="section-block-add-btn" @click="onAddChildBlock">
          + Add block
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type {
  SectionBlock,
  BlockNode,
  ParagraphBlock,
  HeadingBlock,
  DocumentPatch,
} from "@black-bean-sprouts/doc-schema";
import FigureBlockEditor from "./FigureBlockEditor.vue";
import TableBlockEditor from "./TableBlockEditor.vue";
import FormulaBlockEditor from "./FormulaBlockEditor.vue";
import AbstractBlockEditor from "./AbstractBlockEditor.vue";
import ReferenceListBlockEditor from "./ReferenceListBlockEditor.vue";
import ParagraphBlockEditor from "./ParagraphBlockEditor.vue";
import HeadingBlockEditor from "./HeadingBlockEditor.vue";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: SectionBlock;
}>();

const emit = defineEmits<{
  (e: "patch", patches: readonly DocumentPatch[]): void;
}>();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const collapsed = ref(false);

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

function replacePatch(overrides: Partial<SectionBlock>): void {
  emit("patch", [
    {
      op: "replace",
      blockId: props.block.id,
      block: { ...props.block, ...overrides },
    },
  ]);
}

function forwardPatch(patches: readonly DocumentPatch[]): void {
  emit("patch", patches);
}

// ---------------------------------------------------------------------------
// Title editing
// ---------------------------------------------------------------------------

function onTitleBlur(event: Event): void {
  const newTitle = (event.target as HTMLInputElement).value;
  if (newTitle !== props.block.title) {
    replacePatch({ title: newTitle });
  }
}

// ---------------------------------------------------------------------------
// Child management
// ---------------------------------------------------------------------------

function onRemoveChild(index: number): void {
  const updated = [...props.block.children];
  updated.splice(index, 1);
  replacePatch({ children: updated });
}

function onAddChildBlock(): void {
  const newBlock: ParagraphBlock = {
    type: "paragraph",
    id: genId("p"),
    children: [{ type: "text", text: "" }],
  };
  emit("patch", [
    {
      op: "insert",
      parentId: props.block.id,
      index: props.block.children.length,
      block: newBlock,
    },
  ]);
}
</script>

<style scoped>
.section-block-editor {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  margin: 8px 0;
  background: #fff;
}

.section-block-editor--collapsed {
  background: #f8f9fa;
}

.section-block-title-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f0f2f5;
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid #d0d7de;
}

.section-block-editor--collapsed .section-block-title-bar {
  border-radius: 6px;
  border-bottom: none;
}

.section-block-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
  color: #555;
  display: flex;
  align-items: center;
}

.section-block-toggle:hover {
  color: #222;
}

.section-block-toggle-icon {
  display: inline-block;
  width: 14px;
  text-align: center;
}

.section-block-title-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  outline: none;
  padding: 4px 0;
}

.section-block-title-input::placeholder {
  color: #bbb;
}

.section-block-children {
  padding: 8px 8px 8px 24px;
}

.section-block-child {
  position: relative;
  margin-bottom: 4px;
}

.section-block-child:hover > .section-block-remove-child {
  opacity: 1;
}

.section-block-remove-child {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 3px;
  color: #c44;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}

.section-block-remove-child:hover {
  background: #fff0f0;
  color: #a22;
}

.section-block-add {
  padding: 8px 0 4px;
  text-align: center;
}

.section-block-add-btn {
  background: #fff;
  border: 1px dashed #ccc;
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 13px;
  color: #888;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.section-block-add-btn:hover {
  color: #4a90d9;
  border-color: #4a90d9;
}

.section-block-unknown {
  padding: 12px;
  background: #fff5f5;
  color: #c44;
  font-size: 13px;
  border-radius: 4px;
}
</style>
