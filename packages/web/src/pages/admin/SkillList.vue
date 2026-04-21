<template>
  <div>
    <n-space justify="space-between" align="center">
      <h2>技能管理</h2>
      <n-button type="primary">新建技能</n-button>
    </n-space>
    <n-data-table
      :columns="columns"
      :data="skills"
      :loading="loading"
      style="margin-top: 16px"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { DataTableColumns } from "naive-ui";
import { apiFetch } from "../../lib/api.js";

export interface Skill {
  id: string;
  code: string;
  name: string;
  docTypeCode: string | null;
  isActive: boolean;
}

type SkillRow = NonNullable<Skill>;

const skills = ref<Skill[]>([]);
const loading = ref(true);

const columns: DataTableColumns<SkillRow> = [
  { title: "代码", key: "code" },
  { title: "名称", key: "name" },
  { title: "文档类型", key: "docTypeCode" },
  { title: "状态", key: "isActive" },
];

onMounted(async () => {
  try {
    skills.value = await apiFetch<Skill[]>("/admin/skills");
  } catch {
    skills.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
