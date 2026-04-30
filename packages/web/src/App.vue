<template>
  <div class="app-root">
    <DecorativeBg />
    <router-view />
    <AppToast ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import DecorativeBg from "./components/ui/DecorativeBg.vue";
import AppToast from "./components/ui/AppToast.vue";
import { registerToast } from "./composables/useToast.js";

const toastRef = ref<InstanceType<typeof AppToast>>();

onMounted(() => {
  if (toastRef.value) {
    registerToast(toastRef.value);
  }
});
</script>

<style>
.app-root {
  min-height: 100vh;
  position: relative;
}
</style>
