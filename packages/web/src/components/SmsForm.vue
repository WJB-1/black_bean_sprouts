<template>
  <n-space vertical :size="16">
    <n-input
      v-model:value="phone"
      placeholder="请输入手机号"
      :maxlength="11"
      @input="onPhoneInput"
      :status="phoneError ? 'error' : undefined"
    />
    <n-space :size="8" align="center">
      <n-input
        v-model:value="code"
        placeholder="验证码"
        :maxlength="6"
        style="flex: 1"
        :disabled="!smsSent"
        @input="onCodeInput"
      />
      <n-button
        :disabled="!phoneValid || cooldown > 0"
        @click="handleSend"
        :loading="sendingSms"
        style="min-width: 120px"
      >
        {{ cooldown > 0 ? `${cooldown}s 后重发` : smsSent ? "重新发送" : "发送验证码" }}
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
import { ref, computed, onUnmounted } from "vue";
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
const sendingSms = ref(false);
const smsSent = ref(false);
const phoneError = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value));
const canSubmit = computed(() => phoneValid.value && code.value.length === 6);

function onPhoneInput(val: string) {
  // Only allow digits
  phone.value = val.replace(/\D/g, "");
  // Validate phone format
  if (phone.value.length === 11) {
    if (!phoneValid.value) {
      phoneError.value = "请输入正确的手机号";
    } else {
      phoneError.value = null;
    }
  } else {
    phoneError.value = null;
  }
}

function onCodeInput(val: string) {
  // Only allow digits
  code.value = val.replace(/\D/g, "");
}

async function handleSend() {
  if (!phoneValid.value) {
    phoneError.value = "请输入正确的手机号";
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

    timer = setInterval(() => {
      cooldown.value--;
      if (cooldown.value <= 0) {
        clearInterval(timer);
        timer = undefined;
      }
    }, 1000);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "发送失败";
    message.error(errorMsg);
  } finally {
    sendingSms.value = false;
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return;

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
    const errorMsg = err instanceof Error ? err.message : "登录失败";
    message.error(errorMsg);
    // Clear code on error to allow retry
    code.value = "";
  } finally {
    loading.value = false;
  }
}

// Clean up timer on component unmount
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>
