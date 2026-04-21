<template>
  <div style="max-width: 800px; margin: 0 auto; padding: 24px">
    <n-space justify="space-between" align="center">
      <h2>黑豆芽</h2>
      <n-button @click="handleLogout">退出登录</n-button>
    </n-space>
    <n-card style="margin-top: 16px">
      <n-descriptions label-placement="left" :column="1">
        <n-descriptions-item label="用户 ID">
          {{ authStore.user?.id }}
        </n-descriptions-item>
        <n-descriptions-item label="昵称">
          {{ authStore.user?.nickname ?? "未设置" }}
        </n-descriptions-item>
        <n-descriptions-item label="手机">
          {{ authStore.user?.phone ?? "未绑定" }}
        </n-descriptions-item>
        <n-descriptions-item label="等级">
          {{ authStore.user?.tier }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>
    <n-result
      v-if="!authStore.user?.phone"
      style="margin-top: 24px"
      status="info"
      title="绑定手机号"
      description="绑定手机号后可使用更多功能"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const router = useRouter();
const authStore = useAuthStore();

function handleLogout() {
  authStore.logout();
  void router.push({ name: "login" });
}
</script>
