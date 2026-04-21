<template>
  <div style="display: flex; min-height: 100vh">
    <div style="width: 200px; background: #f5f5f5; padding: 16px">
      <h3 style="margin: 0 0 16px">管理后台</h3>
      <n-menu :options="menuOptions" @update:value="handleMenu" />
    </div>
    <div style="flex: 1; padding: 24px">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { type MenuOption } from "naive-ui";

const router = useRouter();

const menuOptions: MenuOption[] = [
  { label: "样式模板", key: "style-profiles" },
  { label: "文档类型", key: "doc-types" },
  { label: "技能管理", key: "skills" },
];

function handleMenu(key: string): void {
  void router.push({ name: key });
}
</script>
