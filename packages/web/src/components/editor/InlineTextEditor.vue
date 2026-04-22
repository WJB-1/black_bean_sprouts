<template>
  <n-input
    :value="modelValue"
    type="textarea"
    class="apple-inline-editor"
    :placeholder="placeholder"
    :autosize="{ minRows, maxRows }"
    @update:value="emit('update:modelValue', $event)"
    @blur="emit('commit')"
    @keydown="handleKeydown"
  />
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
}>(), {
  placeholder: "",
  minRows: 3,
  maxRows: 10,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  commit: [];
}>();

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter") {
    return;
  }
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }
  event.preventDefault();
  emit("commit");
}
</script>
