<template>
  <section style="display: grid; gap: 12px;">
    <p class="apple-caption">{{ node.attrs.caption || "未填写表题" }}</p>

    <div style="overflow-x: auto;">
      <table class="apple-table">
        <tbody>
          <tr v-for="(row, rowIndex) in node.content" :key="rowIndex">
            <template v-for="(cell, cellIndex) in row.cells" :key="cellIndex">
              <th
                v-if="cell.header"
                :colspan="cell.colspan ?? 1"
                :rowspan="cell.rowspan ?? 1"
              >
                {{ inlineNodesToText(cell.content) }}
              </th>
              <td
                v-else
                :colspan="cell.colspan ?? 1"
                :rowspan="cell.rowspan ?? 1"
              >
                {{ inlineNodesToText(cell.content) }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Table } from "@black-bean-sprouts/doc-schema";
import { inlineNodesToText } from "../../lib/doc.js";

defineProps<{ node: Table }>();
</script>
