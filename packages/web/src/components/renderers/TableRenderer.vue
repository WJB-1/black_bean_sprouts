<template>
  <div>
    <p v-if="safeCaption" class="caption">{{ safeCaption }}</p>
    <table v-if="safeRows.length > 0">
      <tr v-for="(row, ri) in safeRows" :key="getRowKey(row, ri)">
        <td
          v-for="(cell, ci) in safeCells(row)"
          :key="ci"
          :class="{ header: cell.header }"
        >
          {{ cellText(cell) }}
        </td>
      </tr>
    </table>
    <p v-else class="empty-table">[空表格]</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TableNode, Cell, Row } from "./types";

const props = defineProps<{ node: TableNode }>();

const safeCaption = computed(() => {
  const caption = props.node.attrs?.caption;
  return caption && typeof caption === "string" ? caption : "";
});

const safeRows = computed(() => {
  const content = props.node.content;
  if (!content) return [];
  if (!Array.isArray(content)) {
    console.warn("TableRenderer: content is not an array", content);
    return [];
  }
  return content as Row[];
});

function getRowKey(row: Row, index: number): string | number {
  const id = row["id"] as string | number | undefined;
  return id ?? index;
}

function safeCells(row: Row): Cell[] {
  const cells = row.cells;
  if (!cells) return [];
  if (!Array.isArray(cells)) {
    console.warn("TableRenderer: cells is not an array", cells);
    return [];
  }
  return cells;
}

function cellText(cell: Cell): string {
  const content = cell.content;
  if (!content) return "";
  if (!Array.isArray(content)) {
    console.warn("TableRenderer: cell content is not an array", content);
    return "";
  }
  return content.map((c) => {
    if (typeof c === "object" && c !== null && "text" in c) {
      return (c as { text?: string }).text ?? "";
    }
    return "";
  }).join("");
}
</script>

<style scoped>
.caption { text-align: center; font-size: 14px; color: #666; margin-bottom: 8px; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}
td {
  border: 1px solid #ddd;
  padding: 8px;
  min-width: 40px;
}
td.header {
  background: #f5f5f5;
  font-weight: bold;
}
.empty-table {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 4px;
}
</style>
