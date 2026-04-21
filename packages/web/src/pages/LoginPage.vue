<template>
  <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5">
    <n-card title="黑豆芽 — 登录" style="width: 400px">
      <n-tabs type="line" animated>
        <n-tab-pane name="sms" tab="手机登录">
          <sms-form @success="onSmsSuccess" />
        </n-tab-pane>
        <n-tab-pane name="wechat" tab="微信登录">
          <n-space vertical align="center" :size="16" style="padding: 24px 0">
            <n-button type="success" size="large" @click="wechatLogin">
              微信扫码登录
            </n-button>
            <n-text v-if="loginError" type="error" depth="3" style="font-size: 12px">
              {{ loginError }}
            </n-text>
          </n-space>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { ref, onMounted } from "vue";
import { useAuthStore } from "../stores/auth.js";
import { setAccessToken } from "../lib/token.js";
import { useMessage } from "naive-ui";
import SmsForm from "../components/SmsForm.vue";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const message = useMessage();

// Check for WeChat callback token or errors in URL
const loginError = ref<string | null>(null);

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  const error = urlParams.get("error");
  const errorDescription = urlParams.get("error_description");

  if (error) {
    loginError.value = errorDescription ?? "微信登录失败";
    message.error(loginError.value);
  } else if (token) {
    // Successful WeChat login
    try {
      setAccessToken(token);
      // Fetch user profile
      void authStore.fetchUser().then(() => {
        const redirect = route.query["redirect"] as string ?? "/documents";
        void router.push(redirect);
      }).catch(() => {
        // If fetchUser fails, still proceed with login
        const redirect = route.query["redirect"] as string ?? "/documents";
        void router.push(redirect);
      });
    } catch {
      message.error("登录失败，请重试");
    }
  }
});

function onSmsSuccess(payload: { accessToken: string; user: unknown }): void {
  setAccessToken(payload.accessToken);
  authStore.user = payload.user as { id: string; nickname: string | null; phone: string | null; avatarUrl: string | null; tier: string };
  // Redirect to the page user was trying to access, or home
  const redirect = route.query["redirect"] as string ?? "/documents";
  void router.push(redirect);
}

function wechatLogin(): void {
  // Store current path for redirect after login
  const currentPath = route.fullPath !== "/login" ? route.fullPath : "/documents";
  // Build redirect URL - use the current path as redirect target
  window.location.href = `/api/auth/wechat?redirect=${encodeURIComponent(currentPath)}`;
}
</script>
