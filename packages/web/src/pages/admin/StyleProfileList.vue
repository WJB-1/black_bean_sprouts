<template>
  <div>
    <n-space justify="space-between" align="center">
      <h2>样式模板</h2>
      <n-button type="primary">新建模板</n-button>
    </n-space>
    <n-data-table
      :columns="columns"
      :data="profiles"
      :loading="loading"
      style="margin-top: 16px"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { DataTableColumns } from "naive-ui";
import { apiFetch } from "../../lib/api.js";

export interface StyleProfile {
  id: string;
  name: string;
  docTypeCode: string;
  version: string;
  isActive: boolean;
  createdAt: string;
}

type ProfileRow = NonNullable<StyleProfile>;

const profiles = ref<StyleProfile[]>([]);
const loading = ref(true);

const columns: DataTableColumns<ProfileRow> = [
  { title: "名称", key: "name" },
  { title: "文档类型", key: "docTypeCode" },
  { title: "版本", key: "version" },
  {
    title: "状态",
    key: "isActive",
    render: (row: ProfileRow): string => (row.isActive ? "激活" : "禁用"),
  },
  {
    title: "创建时间",
    key: "createdAt",
    render: (row: ProfileRow): string => new Date(row.createdAt).toLocaleString(),
  },
];

onMounted(async () => {
  try {
    profiles.value = await apiFetch<StyleProfile[]>("/admin/style-profiles");
  } catch {
    profiles.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
