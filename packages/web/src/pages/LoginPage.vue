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
          </n-space>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";
import { setAccessToken } from "../lib/token.js";
import SmsForm from "../components/SmsForm.vue";

const router = useRouter();
const authStore = useAuthStore();

function onSmsSuccess(payload: { accessToken: string; user: unknown }) {
  setAccessToken(payload.accessToken);
  authStore.user = payload.user as { id: string; nickname: string | null; phone: string | null; avatarUrl: string | null; tier: string };
  void router.push({ name: "home" });
}

function wechatLogin() {
  window.location.href = "/api/auth/wechat";
}
</script>
