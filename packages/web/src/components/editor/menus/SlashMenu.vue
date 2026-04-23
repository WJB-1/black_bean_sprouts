<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="slash-menu"
      :style="menuPosition"
    >
      <div class="slash-menu-filter">
        <input
          ref="filterInput"
          v-model="filter"
          class="slash-menu-filter-input"
          placeholder="Filter..."
          @keydown.down.prevent="highlightNext"
          @keydown.up.prevent="highlightPrev"
          @keydown.enter.prevent="selectHighlighted"
          @keydown.escape.prevent="emit('close')"
        />
      </div>
      <ul class="slash-menu-list" role="listbox">
        <li
          v-for="(item, idx) in filteredItems"
          :key="item.type"
          class="slash-menu-item"
          :class="{ 'slash-menu-item--active': idx === highlightedIndex }"
          role="option"
          :aria-selected="idx === highlightedIndex"
          @click="selectItem(item)"
          @mouseenter="highlightedIndex = idx"
        >
          <span class="slash-menu-item-icon">{{ item.icon }}</span>
          <span class="slash-menu-item-label">{{ item.label }}</span>
          <span class="slash-menu-item-hint">{{ item.hint }}</span>
        </li>
        <li v-if="filteredItems.length === 0" class="slash-menu-empty">
          No matching blocks
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import type {
  DocumentPatch,
  BlockNode,
} from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlashMenuItem = {
  readonly type: string;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
};

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  visible: boolean;
  /** Pixel coordinates of the "/" trigger position */
  coords: { readonly x: number; readonly y: number };
  /** ID of the parent where new blocks should be inserted */
  parentId: string;
  /** Insertion index inside the parent's children */
  insertIndex: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "patch", patches: readonly DocumentPatch[]): void;
}>();

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

const MENU_ITEMS: readonly SlashMenuItem[] = [
  { type: "section",        label: "Section",         icon: "S", hint: "Collapsible section with title" },
  { type: "paragraph",      label: "Paragraph",       icon: "P", hint: "Plain text paragraph" },
  { type: "figure",         label: "Figure",          icon: "F", hint: "Image with caption" },
  { type: "table",          label: "Table",           icon: "T", hint: "Editable table grid" },
  { type: "formula",        label: "Formula",         icon: "Fm", hint: "LaTeX formula block" },
  { type: "reference-list", label: "Reference List",  icon: "R", hint: "Bibliography references" },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const filter = ref("");
const highlightedIndex = ref(0);
const menuRef = ref<HTMLElement | null>(null);
const filterInput = ref<HTMLInputElement | null>(null);

// ---------------------------------------------------------------------------
// Fuzzy search
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

const filteredItems = computed(() => {
  if (!filter.value) return [...MENU_ITEMS];
  return MENU_ITEMS.filter((item) =>
    fuzzyMatch(filter.value, item.label) || fuzzyMatch(filter.value, item.type),
  );
});

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

const menuPosition = computed(() => ({
  position: "absolute" as const,
  left: `${props.coords.x}px`,
  top: `${props.coords.y}px`,
  zIndex: 9999,
}));

// ---------------------------------------------------------------------------
// ID generation (session-unique)
// ---------------------------------------------------------------------------

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

// ---------------------------------------------------------------------------
// Block factory — creates the default BlockNode for each menu item type
// ---------------------------------------------------------------------------

function createBlock(type: string): BlockNode {
  switch (type) {
    case "paragraph":
      return { type: "paragraph", id: genId("p"), children: [{ type: "text", text: "" }] };
    case "section":
      return { type: "section", id: genId("sec"), title: "Untitled Section", children: [] };
    case "figure":
      return { type: "figure", id: genId("fig"), src: "", alt: "" };
    case "table": {
      const cellId = () => genId("tc");
      const rowId = () => genId("tr");
      const emptyCell = (): import("@black-bean-sprouts/doc-schema").TableCell => ({
        id: cellId(),
        children: [{ type: "paragraph", id: genId("p"), children: [{ type: "text", text: "" }] }],
      });
      const emptyRow = (): import("@black-bean-sprouts/doc-schema").TableRow => ({
        id: rowId(),
        cells: [emptyCell(), emptyCell(), emptyCell()],
      });
      return {
        type: "table",
        id: genId("tbl"),
        rows: [emptyRow(), emptyRow()],
      };
    }
    case "formula":
      return { type: "formula", id: genId("fm"), latex: "" };
    case "reference-list":
      return { type: "reference-list", id: genId("ref"), items: [] };
    default:
      return { type: "paragraph", id: genId("p"), children: [{ type: "text", text: "" }] };
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

function selectItem(item: SlashMenuItem) {
  const block = createBlock(item.type);
  const patch: DocumentPatch = {
    op: "insert",
    parentId: props.parentId,
    index: props.insertIndex,
    block,
  };
  emit("patch", [patch]);
  emit("close");
}

function selectHighlighted() {
  const items = filteredItems.value;
  if (items.length > 0 && highlightedIndex.value < items.length) {
    selectItem(items[highlightedIndex.value]!);
  }
}

function highlightNext() {
  const max = filteredItems.value.length - 1;
  highlightedIndex.value = highlightedIndex.value >= max ? 0 : highlightedIndex.value + 1;
}

function highlightPrev() {
  const max = filteredItems.value.length - 1;
  highlightedIndex.value = highlightedIndex.value <= 0 ? max : highlightedIndex.value - 1;
}

// ---------------------------------------------------------------------------
// Reset state when menu opens
// ---------------------------------------------------------------------------

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      filter.value = "";
      highlightedIndex.value = 0;
      nextTick(() => {
        filterInput.value?.focus();
      });
    }
  },
);

// Reset highlight when filter changes
watch(filter, () => {
  highlightedIndex.value = 0;
});
</script>

<style scoped>
.slash-menu {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  min-width: 280px;
  max-height: 360px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #1a1a1a;
  padding: 4px 0;
}

.slash-menu-filter {
  padding: 8px 8px 4px;
}

.slash-menu-filter-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 13px;
  outline: none;
}

.slash-menu-filter-input:focus {
  border-color: #4a90d9;
}

.slash-menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.slash-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.slash-menu-item--active {
  background: #f0f4ff;
}

.slash-menu-item-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
  color: #555;
}

.slash-menu-item-label {
  flex: 1;
  font-weight: 500;
}

.slash-menu-item-hint {
  font-size: 12px;
  color: #999;
}

.slash-menu-empty {
  padding: 16px 12px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
