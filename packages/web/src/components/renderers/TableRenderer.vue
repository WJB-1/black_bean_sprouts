<template>
  <div>
    <p class="caption">{{ caption }}</p>
    <table>
      <tr v-for="(row, ri) in rows" :key="ri">
        <td v-for="(cell, ci) in row.cells" :key="ci" :class="{ header: cell.header }">
          {{ cellText(cell) }}
        </td>
      </tr>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { TableNode, Cell } from "./types";

const props = defineProps<{ node: TableNode }>();

const caption = props.node.attrs?.caption ?? "";
const rows = props.node.content ?? [];

function cellText(cell: Cell): string {
  return cell.content?.map((c) => c.text ?? "").join("") ?? "";
}
</script>

<style scoped>
.caption { text-align: center; font-size: 14px; color: #666; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
td { border: 1px solid #ddd; padding: 8px; }
td.header { background: #f5f5f5; font-weight: bold; }
</style>
