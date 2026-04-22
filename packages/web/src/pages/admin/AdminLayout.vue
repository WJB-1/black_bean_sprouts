<template>
  <div class="apple-page">
    <div class="apple-shell apple-admin-layout">
      <aside class="apple-panel apple-admin-sidebar">
        <p class="apple-kicker">Admin Console</p>
        <h1 class="apple-section-title" style="margin-top: 0;">配置后台</h1>
        <p class="apple-muted">
          统一查看文档类型、技能和样式模板，确保前后端配置保持一致。
        </p>

        <div class="apple-actions" style="margin: 18px 0 20px;">
          <n-button @click="router.push({ name: 'documents' })">返回文档中心</n-button>
          <n-button tertiary @click="handleLogout">退出登录</n-button>
        </div>

        <n-menu
          :value="selectedKey"
          :options="menuOptions"
          @update:value="handleMenu"
        />
      </aside>

      <main class="apple-panel apple-admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { type MenuOption } from "naive-ui";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../stores/auth.js";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const menuOptions: MenuOption[] = [
  { label: "样式模板", key: "style-profiles" },
  { label: "文档类型", key: "doc-types" },
  { label: "技能管理", key: "skills" },
];

const selectedKey = computed(() => {
  const name = route.name;
  return typeof name === "string" ? name : "style-profiles";
});

function handleMenu(key: string): void {
  void router.push({ name: key });
}

function handleLogout(): void {
  authStore.logout();
  void router.push({ name: "login" });
}
</script>
