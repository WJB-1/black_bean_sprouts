<template>
  <div class="apple-page">
    <div class="apple-shell apple-login-layout">
      <section class="apple-panel apple-login-hero">
        <div>
          <p class="apple-kicker">Apple-Inspired UI</p>
          <h1 class="apple-title">把医学文档工作流，收拢到一个更干净的界面里。</h1>
          <p class="apple-subtitle">
            黑豆芽把文档管理、Agent 协作和 Word 渲染整合成一套顺滑的桌面级体验。
          </p>
        </div>

        <div class="apple-login-points">
          <article class="apple-login-point">
            <strong>文档、Agent、渲染统一入口</strong>
            <p class="apple-muted">减少页面跳转和状态割裂，核心操作都留在同一工作台里。</p>
          </article>
          <article class="apple-login-point">
            <strong>更清晰的排版预览</strong>
            <p class="apple-muted">用接近纸张的视觉层次查看 AST 内容，问题更容易暴露出来。</p>
          </article>
          <article class="apple-login-point">
            <strong>更稳的会话恢复</strong>
            <p class="apple-muted">登录后自动回到刚才想访问的页面，不再打断当前任务。</p>
          </article>
        </div>
      </section>

      <section class="apple-panel apple-login-card">
        <p class="apple-kicker">欢迎回来</p>
        <h2 class="apple-section-title">登录你的工作台</h2>
        <p class="apple-muted" style="margin-bottom: 18px;">
          推荐先使用短信验证码登录；如已接入微信开放平台，也可直接扫码。
        </p>

        <n-alert
          v-if="loginError"
          type="error"
          :show-icon="false"
          style="margin-bottom: 16px;"
        >
          {{ loginError }}
        </n-alert>

        <n-tabs type="segment" animated>
          <n-tab-pane name="sms" tab="短信登录">
            <sms-form @success="onSmsSuccess" />
          </n-tab-pane>
          <n-tab-pane name="wechat" tab="微信登录">
            <div class="apple-form-stack">
              <p class="apple-muted">
                微信登录会在授权完成后自动带你回到当前想访问的页面。
              </p>
              <n-button type="primary" block size="large" @click="wechatLogin">
                微信扫码登录
              </n-button>
              <p class="apple-muted">
                如果服务端尚未配置微信开放平台，会返回明确的配置提示。
              </p>
            </div>
          </n-tab-pane>
        </n-tabs>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { useRoute, useRouter } from "vue-router";
import SmsForm from "../components/SmsForm.vue";
import { setAccessToken } from "../lib/token.js";
import { useAuthStore } from "../stores/auth.js";

interface LoginPayload {
  accessToken: string;
  user: {
    id: string;
    nickname: string | null;
    phone: string | null;
    avatarUrl: string | null;
    tier: string;
  };
}

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const message = useMessage();
const loginError = ref<string | null>(null);

function readRouteQuery(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

function getRedirectTarget(): string {
  const redirect = readRouteQuery(route.query["redirect"]);
  return redirect && redirect.startsWith("/") ? redirect : "/documents";
}

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  const error = urlParams.get("error");
  const errorDescription = urlParams.get("error_description");

  if (error) {
    loginError.value = errorDescription ?? "微信登录失败，请稍后重试。";
    message.error(loginError.value);
    return;
  }

  if (!token) {
    return;
  }

  try {
    setAccessToken(token);
    await authStore.fetchUser();

    if (!authStore.user) {
      throw new Error("登录状态恢复失败");
    }

    await router.replace(getRedirectTarget());
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : "登录失败，请稍后重试。";
    message.error(loginError.value);
  }
});

function onSmsSuccess(payload: LoginPayload): void {
  authStore.applySession(payload);
  void router.push(getRedirectTarget());
}

function wechatLogin(): void {
  window.location.href = `/api/auth/wechat?redirect=${encodeURIComponent(getRedirectTarget())}`;
}
</script>
