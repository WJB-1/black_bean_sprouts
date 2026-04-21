<template>
  <n-space vertical :size="16">
    <n-input
      v-model:value="phone"
      placeholder="请输入手机号"
      :maxlength="11"
      @input="onPhoneInput"
    />
    <n-space :size="8" align="center">
      <n-input
        v-model:value="code"
        placeholder="验证码"
        :maxlength="6"
        style="flex: 1"
      />
      <n-button
        :disabled="!phoneValid || cooldown > 0"
        @click="handleSend"
        style="min-width: 120px"
      >
        {{ cooldown > 0 ? `${cooldown}s 后重发` : "发送验证码" }}
      </n-button>
    </n-space>
    <n-button
      type="primary"
      block
      :disabled="!canSubmit"
      :loading="loading"
      @click="handleSubmit"
    >
      登录
    </n-button>
  </n-space>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useMessage } from "naive-ui";
import { apiFetch } from "../lib/api.js";

const emit = defineEmits<{
  success: [payload: { accessToken: string; user: unknown }];
}>();

const message = useMessage();
const phone = ref("");
const code = ref("");
const cooldown = ref(0);
const loading = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value));
const canSubmit = computed(() => phoneValid.value && /^\d{6}$/.test(code.value));

function onPhoneInput(val: string) {
  phone.value = val.replace(/\D/g, "");
}

async function handleSend() {
  try {
    await apiFetch("/auth/sms/send", {
      method: "POST",
      body: JSON.stringify({ phone: phone.value }),
    });
    message.success("验证码已发送");
    cooldown.value = 60;
    timer = setInterval(() => {
      cooldown.value--;
      if (cooldown.value <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  } catch (err) {
    message.error((err as Error).message);
  }
}

async function handleSubmit() {
  loading.value = true;
  try {
    const res = await apiFetch<{ accessToken: string; user: unknown }>(
      "/auth/sms/verify",
      {
        method: "POST",
        body: JSON.stringify({ phone: phone.value, code: code.value }),
      },
    );
    emit("success", res);
  } catch (err) {
    message.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}
</script>
