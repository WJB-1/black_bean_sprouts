<template>
  <div class="table-block-editor">
    <table class="table-block-grid">
      <thead v-if="block.headerRow">
        <tr>
          <th
            v-for="cell in block.headerRow.cells"
            :key="cell.id"
            class="table-block-cell table-block-cell--header"
          >
            <div
              class="table-block-cell-content"
              contenteditable="true"
              @blur="(e) => onCellBlur(block.headerRow!.id, cell.id, e)"
            >{{ cellText(cell) }}</div>
          </th>
          <th class="table-block-cell-actions">
            <button
              class="table-block-btn table-block-btn--danger"
              title="Remove header row"
              @click="onRemoveHeaderRow"
            >&times;</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIdx) in block.rows" :key="row.id">
          <td
            v-for="cell in row.cells"
            :key="cell.id"
            class="table-block-cell"
          >
            <div
              class="table-block-cell-content"
              contenteditable="true"
              @blur="(e) => onCellBlur(row.id, cell.id, e)"
            >{{ cellText(cell) }}</div>
          </td>
          <td class="table-block-cell-actions">
            <button
              class="table-block-btn table-block-btn--danger"
              title="Remove row"
              @click="onRemoveRow(rowIdx)"
            >&times;</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="table-block-toolbar">
      <button class="table-block-btn" @click="onAddRow">+ Row</button>
      <button class="table-block-btn" @click="onAddColumn">+ Column</button>
      <button class="table-block-btn" @click="onRemoveColumn">- Column</button>
      <button
        v-if="!block.headerRow"
        class="table-block-btn"
        @click="onToggleHeader"
      >
        Toggle Header
      </button>
      <button
        v-else
        class="table-block-btn"
        @click="onToggleHeader"
      >
        Remove Header
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  TableBlock,
  TableRow,
  TableCell,
  ParagraphBlock,
  DocumentPatch,
} from "@black-bean-sprouts/doc-schema";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  block: TableBlock;
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

function cellText(cell: TableCell): string {
  return cell.children
    .map((p: ParagraphBlock) =>
      p.children
        .filter((n) => n.type === "text")
        .map((n) => (n.type === "text" ? n.text : ""))
        .join(""),
    )
    .join("\n");
}

function emptyCell(): TableCell {
  const para: ParagraphBlock = {
    type: "paragraph",
    id: genId("p"),
    children: [{ type: "text", text: "" }],
  };
  return { id: genId("tc"), children: [para] };
}

function emptyRow(colCount: number): TableRow {
  return {
    id: genId("tr"),
    cells: Array.from({ length: colCount }, () => emptyCell()),
  };
}

function cellCount(): number {
  if (props.block.headerRow) return props.block.headerRow.cells.length;
  if (props.block.rows.length > 0) return props.block.rows[0]!.cells.length;
  return 3;
}

// ---------------------------------------------------------------------------
// Patch helpers
// ---------------------------------------------------------------------------

function replacePatch(overrides: Partial<TableBlock>): void {
  emit("patch", [
    {
      op: "replace",
      blockId: props.block.id,
      block: { ...props.block, ...overrides },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Cell editing
// ---------------------------------------------------------------------------

function onCellBlur(rowId: string, cellId: string, event: Event): void {
  const text = (event.target as HTMLElement).textContent ?? "";
  const para: ParagraphBlock = {
    type: "paragraph",
    id: genId("p"),
    children: [{ type: "text", text }],
  };
  const newCell: TableCell = { id: cellId, children: [para] };
  emit("patch", [
    {
      op: "replaceTableCell",
      tableId: props.block.id,
      rowId,
      cellId,
      cell: newCell,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Row operations
// ---------------------------------------------------------------------------

function onAddRow(): void {
  const row = emptyRow(cellCount());
  emit("patch", [
    { op: "insertTableRow", tableId: props.block.id, index: props.block.rows.length, row },
  ]);
}

function onRemoveRow(index: number): void {
  emit("patch", [
    { op: "removeTableRow", tableId: props.block.id, index },
  ]);
}

// ---------------------------------------------------------------------------
// Column operations
// ---------------------------------------------------------------------------

function onAddColumn(): void {
  const newCell = emptyCell();
  const updatedRows = props.block.rows.map((row) => ({
    ...row,
    cells: [...row.cells, { ...newCell, id: genId("tc") }],
  }));
  const updatedHeader = props.block.headerRow
    ? { ...props.block.headerRow, cells: [...props.block.headerRow.cells, { ...newCell, id: genId("tc") }] }
    : undefined;
  replacePatch({ rows: updatedRows, headerRow: updatedHeader });
}

function onRemoveColumn(): void {
  if (cellCount() <= 1) return;
  const updatedRows = props.block.rows.map((row) => ({
    ...row,
    cells: row.cells.slice(0, -1),
  }));
  const updatedHeader = props.block.headerRow
    ? { ...props.block.headerRow, cells: props.block.headerRow.cells.slice(0, -1) }
    : undefined;
  replacePatch({ rows: updatedRows, headerRow: updatedHeader });
}

// ---------------------------------------------------------------------------
// Header row toggle
// ---------------------------------------------------------------------------

function onToggleHeader(): void {
  if (props.block.headerRow) {
    // Move header back into regular rows
    replacePatch({
      headerRow: undefined,
      rows: [props.block.headerRow, ...props.block.rows],
    });
  } else if (props.block.rows.length > 0) {
    // Promote first row to header
    const [first, ...rest] = props.block.rows;
    replacePatch({ headerRow: first, rows: rest });
  }
}

function onRemoveHeaderRow(): void {
  if (props.block.headerRow) {
    replacePatch({
      headerRow: undefined,
      rows: [props.block.headerRow, ...props.block.rows],
    });
  }
}
</script>

<style scoped>
.table-block-editor {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
  margin: 8px 0;
  overflow-x: auto;
}

.table-block-grid {
  border-collapse: collapse;
  width: 100%;
}

.table-block-cell {
  border: 1px solid #ddd;
  padding: 0;
  min-width: 80px;
  vertical-align: top;
}

.table-block-cell--header {
  background: #f0f0f0;
  font-weight: 600;
}

.table-block-cell-content {
  padding: 6px 8px;
  min-height: 28px;
  outline: none;
  font-size: 14px;
  line-height: 1.4;
}

.table-block-cell-content:empty::before {
  content: "\00a0";
}

.table-block-cell-actions {
  border: none;
  padding: 2px 4px;
  vertical-align: middle;
  width: 28px;
}

.table-block-toolbar {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.table-block-btn {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.table-block-btn:hover {
  background: #f0f4ff;
}

.table-block-btn--danger {
  color: #c44;
  font-size: 14px;
  line-height: 1;
  padding: 2px 6px;
}

.table-block-btn--danger:hover {
  background: #fff0f0;
}
</style>
