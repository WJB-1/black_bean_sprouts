<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="logo-svg"
  >
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1" />
        <stop offset="50%" stop-color="#8b5cf6" />
        <stop offset="100%" stop-color="#a855f7" />
      </linearGradient>
      <filter id="logoGlow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <!-- 外圈 -->
    <circle cx="60" cy="60" r="54" stroke="url(#logoGrad)" stroke-width="2" opacity="0.3" />
    <circle cx="60" cy="60" r="48" stroke="url(#logoGrad)" stroke-width="1" opacity="0.15" />

    <!-- 中心芽 -->
    <path
      d="M60 28 C60 28 45 38 45 55 C45 68 52 76 58 80 L58 92 L62 92 L62 80 C68 76 75 68 75 55 C75 38 60 28 60 28Z"
      fill="url(#logoGrad)"
      filter="url(#logoGlow)"
    />
    <!-- 左叶 -->
    <path
      d="M58 50 C58 50 42 45 36 52 C30 59 35 68 42 70 C48 72 55 65 58 60Z"
      fill="url(#logoGrad)"
      opacity="0.8"
    />
    <!-- 右叶 -->
    <path
      d="M62 50 C62 50 78 45 84 52 C90 59 85 68 78 70 C72 72 65 65 62 60Z"
      fill="url(#logoGrad)"
      opacity="0.8"
    />
    <!-- 茎 -->
    <line x1="60" y1="80" x2="60" y2="92" stroke="url(#logoGrad)" stroke-width="3" stroke-linecap="round" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  size?: number;
}>();
</script>

<style scoped>
.logo-svg {
  filter: drop-shadow(0 0 12px rgba(99, 102, 241, 0.4));
}
</style>
