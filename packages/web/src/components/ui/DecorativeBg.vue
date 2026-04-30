<template>
  <div class="decorative-bg">
    <!-- 渐变光晕 -->
    <div class="glow-orb glow-orb--1"></div>
    <div class="glow-orb glow-orb--2"></div>
    <div class="glow-orb glow-orb--3"></div>

    <!-- 网格线 -->
    <svg class="grid-overlay" width="100%" height="100%">
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>

    <!-- 噪点纹理 -->
    <div class="noise-overlay"></div>
  </div>
</template>

<style scoped>
.decorative-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.15;
  animation: float 20s ease-in-out infinite;
}

.glow-orb--1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #6366f1 0%, transparent 70%);
  top: -200px;
  right: -100px;
  animation-delay: 0s;
}

.glow-orb--2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
  bottom: -150px;
  left: -100px;
  animation-delay: -7s;
}

.glow-orb--3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #a855f7 0%, transparent 70%);
  top: 50%;
  left: 50%;
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

.grid-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.5;
}

.noise-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}
</style>
