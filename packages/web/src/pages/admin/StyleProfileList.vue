<template>
  <section>
    <p class="apple-kicker">Style Profiles</p>
    <h2 class="apple-section-title">样式模板</h2>
    <p class="apple-muted">这里的模板决定导出时的页边距、字号、编号规则和摘要样式。</p>

    <div class="apple-grid apple-stats" style="margin-top: 18px;">
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ profiles.length }}</p>
        <p class="apple-stat-label">模板总数</p>
      </article>
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ activeCount }}</p>
        <p class="apple-stat-label">当前启用</p>
      </article>
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ docTypeCount }}</p>
        <p class="apple-stat-label">覆盖文档类型</p>
      </article>
    </div>

    <n-spin :show="loading">
      <section v-if="profiles.length > 0" class="apple-card-grid">
        <article v-for="profile in profiles" :key="profile.id" class="apple-panel apple-card">
          <div class="apple-card-head">
            <div>
              <h3 style="margin: 0 0 6px;">{{ profile.name }}</h3>
              <p class="apple-muted">{{ profile.docTypeCode }} · 版本 {{ profile.version }}</p>
            </div>
            <n-tag :type="profile.isActive ? 'success' : 'default'" round>
              {{ profile.isActive ? "启用" : "停用" }}
            </n-tag>
          </div>
          <div class="apple-header-meta">
            <span class="apple-badge">创建于 {{ formatDateTime(profile.createdAt) }}</span>
            <span class="apple-badge">ID：{{ profile.id }}</span>
          </div>
        </article>
      </section>

      <section v-else class="apple-panel apple-empty">
        <div>
          <h3 style="margin-top: 0;">暂时没有样式模板</h3>
          <p class="apple-muted">当前系统会退回到服务端内置默认样式。</p>
        </div>
      </section>
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { apiFetch } from "../../lib/api.js";
import { formatDateTime } from "../../lib/format.js";

interface StyleProfileRecord {
  id: string;
  name: string;
  docTypeCode: string;
  version: string;
  isActive: boolean;
  createdAt: string;
}

const message = useMessage();
const profiles = ref<StyleProfileRecord[]>([]);
const loading = ref(true);
const activeCount = computed(() => profiles.value.filter((item) => item.isActive).length);
const docTypeCount = computed(() => new Set(profiles.value.map((item) => item.docTypeCode)).size);

onMounted(async () => {
  try {
    profiles.value = await apiFetch<StyleProfileRecord[]>("/admin/style-profiles");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "样式模板加载失败");
  } finally {
    loading.value = false;
  }
});
</script>
