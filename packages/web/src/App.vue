<template>
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme-overrides="themeOverrides"
  >
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <router-view />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { dateZhCN, zhCN, type GlobalThemeOverrides } from "naive-ui";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#0071e3",
    primaryColorHover: "#2488f5",
    primaryColorPressed: "#005ec3",
    successColor: "#34c759",
    warningColor: "#ff9f0a",
    errorColor: "#ff453a",
    borderRadius: "20px",
    borderRadiusSmall: "14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
    textColorBase: "#111827",
    bodyColor: "rgba(255,255,255,0.76)",
    cardColor: "rgba(255,255,255,0.82)",
    modalColor: "rgba(255,255,255,0.9)",
  },
  Button: {
    borderRadiusMedium: "18px",
    borderRadiusSmall: "16px",
    borderRadiusTiny: "14px",
    textColorPrimary: "#ffffff",
  },
  Card: {
    borderRadius: "28px",
    color: "rgba(255,255,255,0.82)",
  },
  DataTable: {
    thColor: "rgba(248, 250, 252, 0.9)",
    tdColor: "rgba(255, 255, 255, 0.45)",
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  Input: {
    borderRadius: "18px",
  },
  Menu: {
    borderRadius: "18px",
    itemHeight: "46px",
  },
  Modal: {
    borderRadius: "28px",
  },
  Tabs: {
    tabBorderRadius: "16px",
  },
};
</script>
