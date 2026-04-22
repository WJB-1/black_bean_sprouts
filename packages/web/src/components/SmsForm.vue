<template>
  <div class="apple-form-stack">
    <div>
      <p class="apple-kicker">短信验证码</p>
      <p class="apple-muted">开发环境可直接使用 `123456` 作为验证码。</p>
    </div>

    <n-input
      v-model:value="phone"
      placeholder="请输入手机号"
      :maxlength="11"
      @input="onPhoneInput"
      :status="phoneError ? 'error' : undefined"
    />

    <div class="apple-code-row">
      <n-input
        v-model:value="code"
        placeholder="请输入验证码"
        :maxlength="6"
        :disabled="!smsSent"
        @input="onCodeInput"
      />
      <n-button
        :disabled="!phoneValid || cooldown > 0"
        :loading="sendingSms"
        @click="handleSend"
      >
        {{ sendButtonText }}
      </n-button>
    </div>

    <n-text v-if="phoneError" type="error" depth="3">
      {{ phoneError }}
    </n-text>

    <n-button
      type="primary"
      block
      size="large"
      :disabled="!canSubmit"
      :loading="loading"
      @click="handleSubmit"
    >
      进入工作台
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { apiFetch } from "../lib/api.js";

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

const emit = defineEmits<{
  success: [payload: LoginPayload];
}>();

const message = useMessage();
const phone = ref("");
const code = ref("");
const cooldown = ref(0);
const loading = ref(false);
const sendingSms = ref(false);
const smsSent = ref(false);
const phoneError = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value));
const canSubmit = computed(() => phoneValid.value && code.value.length === 6);
const sendButtonText = computed(() => {
  if (cooldown.value > 0) {
    return `${cooldown.value}s 后重发`;
  }
  return smsSent.value ? "重新发送" : "发送验证码";
});

function clearCooldownTimer(): void {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
}

function onPhoneInput(value: string): void {
  phone.value = value.replace(/\D/g, "");

  if (phone.value.length === 11 && !phoneValid.value) {
    phoneError.value = "请输入正确的中国大陆手机号";
    return;
  }

  phoneError.value = null;
}

function onCodeInput(value: string): void {
  code.value = value.replace(/\D/g, "");
}

async function handleSend(): Promise<void> {
  if (!phoneValid.value) {
    phoneError.value = "请输入正确的中国大陆手机号";
    return;
  }

  phoneError.value = null;
  sendingSms.value = true;

  try {
    await apiFetch("/auth/sms/send", {
      method: "POST",
      body: JSON.stringify({ phone: phone.value }),
    });

    message.success("验证码已发送");
    smsSent.value = true;
    cooldown.value = 60;
    clearCooldownTimer();

    timer = setInterval(() => {
      cooldown.value -= 1;
      if (cooldown.value <= 0) {
        clearCooldownTimer();
      }
    }, 1000);
  } catch (err) {
    message.error(err instanceof Error ? err.message : "发送验证码失败");
  } finally {
    sendingSms.value = false;
  }
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }

  loading.value = true;
  try {
    const payload = await apiFetch<LoginPayload>("/auth/sms/verify", {
      method: "POST",
      body: JSON.stringify({ phone: phone.value, code: code.value }),
    });
    emit("success", payload);
  } catch (err) {
    code.value = "";
    message.error(err instanceof Error ? err.message : "登录失败，请稍后再试");
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  clearCooldownTimer();
});
</script>
