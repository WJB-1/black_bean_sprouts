<template>
  <Teleport to="body">
    <TransitionGroup
      tag="div"
      name="toast"
      class="toast-container"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast--${toast.type}`]"
        @click="remove(toast.id)"
      >
        <span class="toast-icon">{{ iconFor(toast.type) }}</span>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" type="button" @click.stop="remove(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from "vue";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

const toasts = ref<ToastItem[]>([]);

let seq = 0;

function iconFor(type: ToastType): string {
  switch (type) {
    case "success": return "✓";
    case "error": return "✕";
    case "warning": return "!";
    case "info": return "i";
  }
}

function show(message: string, type: ToastType = "info", duration = 3000) {
  const id = `toast-${++seq}-${Date.now()}`;
  toasts.value.push({ id, message, type, duration });
  if (duration > 0) {
    setTimeout(() => remove(id), duration);
  }
}

function remove(id: string) {
  const index = toasts.value.findIndex((t) => t.id === id);
  if (index >= 0) {
    toasts.value.splice(index, 1);
  }
}

function success(message: string, duration?: number) {
  show(message, "success", duration);
}

function error(message: string, duration?: number) {
  show(message, "error", duration);
}

function warning(message: string, duration?: number) {
  show(message, "warning", duration);
}

function info(message: string, duration?: number) {
  show(message, "info", duration);
}

defineExpose({ show, success, error, warning, info, remove });
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  font-size: 14px;
  font-weight: 500;
  pointer-events: auto;
  cursor: pointer;
  min-width: 260px;
  max-width: 400px;
  border-left: 4px solid transparent;
}

.toast--success { border-left-color: #027a48; color: #027a48; }
.toast--error   { border-left-color: #b42318; color: #b42318; }
.toast--warning { border-left-color: #c2410c; color: #c2410c; }
.toast--info    { border-left-color: #1d4ed8; color: #1d4ed8; }

.toast-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: currentColor;
  color: #fff;
}

.toast--success .toast-icon { background: #027a48; }
.toast--error   .toast-icon { background: #b42318; }
.toast--warning .toast-icon { background: #c2410c; }
.toast--info    .toast-icon { background: #1d4ed8; }

.toast-message {
  flex: 1;
  line-height: 1.5;
}

.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9aa3b2;
  font-size: 18px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.toast-close:hover {
  background: #f0f0f0;
  color: #333;
}

/* Transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}
</style>
