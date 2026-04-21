<template>
  <div>
    <n-space justify="space-between" align="center">
      <h2>文档类型</h2>
      <n-button type="primary">新建类型</n-button>
    </n-space>
    <n-data-table
      :columns="columns"
      :data="docTypes"
      :loading="loading"
      style="margin-top: 16px"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { DataTableColumns } from "naive-ui";
import { apiFetch } from "../../lib/api.js";

export interface DocType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

type DocTypeRow = NonNullable<DocType>;

const docTypes = ref<DocType[]>([]);
const loading = ref(true);

const columns: DataTableColumns<DocTypeRow> = [
  { title: "代码", key: "code" },
  { title: "名称", key: "name" },
  { title: "状态", key: "isActive" },
];

onMounted(async () => {
  try {
    docTypes.value = await apiFetch<DocType[]>("/admin/doc-types");
  } catch {
    docTypes.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
