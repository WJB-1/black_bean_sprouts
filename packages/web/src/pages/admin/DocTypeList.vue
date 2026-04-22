<template>
  <section>
    <p class="apple-kicker">Doc Types</p>
    <h2 class="apple-section-title">文档类型</h2>
    <p class="apple-muted">这里的配置会直接影响新建文档时的类型选择与后续路由行为。</p>

    <div class="apple-grid apple-stats" style="margin-top: 18px;">
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ docTypes.length }}</p>
        <p class="apple-stat-label">类型总数</p>
      </article>
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ activeCount }}</p>
        <p class="apple-stat-label">当前启用</p>
      </article>
    </div>

    <n-spin :show="loading">
      <section v-if="docTypes.length > 0" class="apple-card-grid">
        <article v-for="docType in docTypes" :key="docType.id" class="apple-panel apple-card">
          <div class="apple-card-head">
            <div>
              <h3 style="margin: 0 0 6px;">{{ docType.name }}</h3>
              <p class="apple-muted">代码：{{ docType.code }}</p>
            </div>
            <n-tag :type="docType.isActive ? 'success' : 'default'" round>
              {{ docType.isActive ? "启用" : "停用" }}
            </n-tag>
          </div>
          <p class="apple-muted">{{ docType.description || "暂无描述" }}</p>
        </article>
      </section>

      <section v-else class="apple-panel apple-empty">
        <div>
          <h3 style="margin-top: 0;">还没有文档类型</h3>
          <p class="apple-muted">请先在数据库中初始化文档类型，例如 thesis / sci_paper / proposal。</p>
        </div>
      </section>
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { apiFetch } from "../../lib/api.js";

interface DocTypeRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

const message = useMessage();
const docTypes = ref<DocTypeRecord[]>([]);
const loading = ref(true);
const activeCount = computed(() => docTypes.value.filter((item) => item.isActive).length);

onMounted(async () => {
  try {
    docTypes.value = await apiFetch<DocTypeRecord[]>("/admin/doc-types");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "文档类型加载失败");
  } finally {
    loading.value = false;
  }
});
</script>
