<template>
  <div class="apple-formula">
    {{ node.attrs.latex || "公式待填写" }}
  </div>
</template>

<script setup lang="ts">
import type { Formula } from "@black-bean-sprouts/doc-schema";

defineProps<{ node: Formula }>();
</script>
