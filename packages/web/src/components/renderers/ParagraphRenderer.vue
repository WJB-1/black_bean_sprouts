<template>
  <p :style="paragraphStyle">
    {{ contentText || "（空段落）" }}
  </p>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import { computed } from "vue";
import type { Paragraph } from "@black-bean-sprouts/doc-schema";
import { inlineNodesToText } from "../../lib/doc.js";

const props = defineProps<{ node: Paragraph }>();

const contentText = computed(() => inlineNodesToText(props.node.content));
const paragraphStyle = computed<CSSProperties>(() => {
  const role = props.node.attrs.role ?? "normal";

  if (role === "caption") {
    return {
      margin: "8px 0 0",
      color: "#64748b",
      textAlign: "center",
      fontSize: "14px",
    };
  }

  if (role === "quote") {
    return {
      margin: "12px 0",
      padding: "14px 18px",
      background: "rgba(15, 23, 42, 0.04)",
      borderRadius: "18px",
      color: "#334155",
      lineHeight: "1.85",
    };
  }

  if (role === "code") {
    return {
      margin: "12px 0",
      padding: "14px 18px",
      background: "rgba(15, 23, 42, 0.06)",
      borderRadius: "18px",
      fontFamily: "'SFMono-Regular', Consolas, monospace",
      whiteSpace: "pre-wrap",
    };
  }

  return {
    margin: "8px 0",
    lineHeight: "1.92",
    textIndent: role === "list-item" ? "0" : "2em",
    color: "#0f172a",
  };
});
</script>
