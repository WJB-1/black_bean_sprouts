<template>
  <div class="reflist-block-editor">
    <div class="reflist-block-header">
      <span class="reflist-block-header-label">References</span>
      <button class="reflist-block-btn" @click="onAddItem">+ Reference</button>
    </div>
    <div class="reflist-block-items">
      <div
        v-for="(item, idx) in block.items"
        :key="item.id"
        class="reflist-block-item"
      >
        <div class="reflist-block-item-fields">
          <label class="reflist-block-field">
            <span class="reflist-block-field-label">Key</span>
            <input
              class="reflist-block-field-input"
              type="text"
              :value="item.key"
              @blur="(e) => onFieldChange(idx, 'key', (e.target as HTMLInputElement).value)"
            />
          </label>
          <label class="reflist-block-field">
            <span class="reflist-block-field-label">Title</span>
            <input
              class="reflist-block-field-input reflist-block-field-input--wide"
              type="text"
              :value="item.title"
              @blur="(e) => onFieldChange(idx, 'title', (e.target as HTMLInputElement).value)"
            />
          </label>
          <label class="reflist-block-field">
            <span class="reflist-block-field-label">Authors</span>
            <input
              class="reflist-block-field-input reflist-block-field-input--wide"
              type="text"
              :value="item.authors.join(', ')"
              placeholder="Comma-separated"
              @blur="(e) => onAuthorsChange(idx, (e.target as HTMLInputElement).value)"
            />
          </label>
          <div class="reflist-block-field-row">
            <label class="reflist-block-field">
              <span class="reflist-block-field-label">Year</span>
              <input
                class="reflist-block-field-input reflist-block-field-input--num"
                type="number"
                :value="item.year ?? ''"
                @blur="(e) => onYearChange(idx, (e.target as HTMLInputElement).value)"
              />
            </label>
            <label class="reflist-block-field">
              <span class="reflist-block-field-label">Source</span>
              <input
                class="reflist-block-field-input"
                type="text"
                :value="item.source"
                @blur="(e) => onFieldChange(idx, 'source', (e.target as HTMLInputElement).value)"
              />
            </label>
          </div>
          <div class="reflist-block-field-row">
            <label class="reflist-block-field">
              <span class="reflist-block-field-label">DOI</span>
              <input
                class="reflist-block-field-input"
                type="text"
                :value="item.doi ?? ''"
                @blur="(e) => onFieldChange(idx, 'doi', (e.target as HTMLInputElement).value)"
              />
            </label>
            <label class="reflist-block-field">
              <span class="reflist-block-field-label">URL</span>
              <input
                class="reflist-block-field-input"
                type="text"
                :value="item.url ?? ''"
                @blur="(e) => onFieldChange(idx, 'url', (e.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </div>
        <button
          class="reflist-block-remove-btn"
          title="Remove reference"
          @click="onRemoveItem(idx)"
        >&times;</button>
      </div>
      <div v-if="block.items.length === 0" class="reflist-block-empty">
        No references yet. Click "+ Reference" to add one.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReferenceListBlock, ReferenceItem, DocumentPatch } from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: ReferenceListBlock;
}>();

const emit = defineEmits<{
  (e: "patch", patches: readonly DocumentPatch[]): void;
}>();

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;
function genId(): string {
  return `ref_${Date.now()}_${++idCounter}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function replacePatch(items: readonly ReferenceItem[]): void {
  emit("patch", [
    {
      op: "replace",
      blockId: props.block.id,
      block: { ...props.block, items },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onAddItem(): void {
  const newItem: ReferenceItem = {
    id: genId(),
    key: "",
    authors: [],
    title: "",
    source: "",
  };
  replacePatch([...props.block.items, newItem]);
}

function onRemoveItem(index: number): void {
  const updated = [...props.block.items];
  updated.splice(index, 1);
  replacePatch(updated);
}

function onFieldChange(
  index: number,
  field: "key" | "title" | "source" | "doi" | "url",
  value: string,
): void {
  const updated = [...props.block.items];
  const current = updated[index];
  if (!current) return;
  updated[index] = { ...current, [field]: value };
  replacePatch(updated);
}

function onAuthorsChange(index: number, value: string): void {
  const authors = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const updated = [...props.block.items];
  const current = updated[index];
  if (!current) return;
  updated[index] = { ...current, authors };
  replacePatch(updated);
}

function onYearChange(index: number, value: string): void {
  const year = value === "" ? undefined : Number(value);
  const updated = [...props.block.items];
  const current = updated[index];
  if (!current) return;
  updated[index] = { ...current, year };
  replacePatch(updated);
}
</script>

<style scoped>
.reflist-block-editor {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0;
  background: #fafafa;
  margin: 8px 0;
}

.reflist-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #d0d7de;
  background: #eef1f4;
  border-radius: 6px 6px 0 0;
}

.reflist-block-header-label {
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #444;
}

.reflist-block-btn {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.reflist-block-btn:hover {
  background: #f0f4ff;
}

.reflist-block-items {
  padding: 8px 12px;
}

.reflist-block-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  margin-bottom: 8px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.reflist-block-item-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reflist-block-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.reflist-block-field-label {
  font-weight: 600;
  color: #666;
  min-width: 44px;
  flex-shrink: 0;
}

.reflist-block-field-input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 12px;
  outline: none;
}

.reflist-block-field-input--wide {
  min-width: 200px;
}

.reflist-block-field-input--num {
  width: 70px;
  flex: none;
}

.reflist-block-field-input:focus {
  border-color: #4a90d9;
}

.reflist-block-field-row {
  display: flex;
  gap: 12px;
}

.reflist-block-remove-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #c44;
  font-size: 18px;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
}

.reflist-block-remove-btn:hover {
  color: #a22;
}

.reflist-block-empty {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
