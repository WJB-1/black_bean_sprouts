<template>
  <div class="apple-page">
    <div class="apple-shell">
      <section class="apple-panel apple-header">
        <div>
          <p class="apple-kicker">Black Bean Sprouts</p>
          <h1 class="apple-title">医学文档 Agent 工作台</h1>
          <p class="apple-subtitle">更稳的文档链路，更清晰的排版协作界面。</p>
        </div>
        <div class="apple-actions">
          <n-button @click="router.push({ name: 'documents' })">进入文档中心</n-button>
          <n-button type="primary" @click="router.push({ path: '/admin' })">进入后台</n-button>
          <n-button tertiary @click="handleLogout">退出登录</n-button>
        </div>
      </section>

      <section class="apple-grid apple-stats">
        <article class="apple-panel apple-stat">
          <p class="apple-stat-value">{{ authStore.user?.nickname ?? "未设置昵称" }}</p>
          <p class="apple-stat-label">当前用户</p>
        </article>
        <article class="apple-panel apple-stat">
          <p class="apple-stat-value">{{ authStore.user?.tier ?? "free" }}</p>
          <p class="apple-stat-label">订阅等级</p>
        </article>
        <article class="apple-panel apple-stat">
          <p class="apple-stat-value">{{ authStore.user?.phone ?? "未绑定" }}</p>
          <p class="apple-stat-label">手机号</p>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  if (!authStore.user) {
    void authStore.fetchUser();
  }
});

function handleLogout(): void {
  authStore.logout();
  void router.push({ name: "login" });
}
</script>
