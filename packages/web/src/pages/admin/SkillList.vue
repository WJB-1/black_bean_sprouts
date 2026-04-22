<template>
  <section>
    <p class="apple-kicker">Skills</p>
    <h2 class="apple-section-title">技能配置</h2>
    <p class="apple-muted">技能决定 Agent 可用的系统提示词和工具集，是文档工作流的核心控制面。</p>

    <div class="apple-grid apple-stats" style="margin-top: 18px;">
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ skills.length }}</p>
        <p class="apple-stat-label">技能总数</p>
      </article>
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ activeCount }}</p>
        <p class="apple-stat-label">当前启用</p>
      </article>
      <article class="apple-panel apple-stat">
        <p class="apple-stat-value">{{ linkedDocTypes }}</p>
        <p class="apple-stat-label">绑定文档类型</p>
      </article>
    </div>

    <n-spin :show="loading">
      <section v-if="skills.length > 0" class="apple-card-grid">
        <article v-for="skill in skills" :key="skill.id" class="apple-panel apple-card">
          <div class="apple-card-head">
            <div>
              <h3 style="margin: 0 0 6px;">{{ skill.name }}</h3>
              <p class="apple-muted">{{ skill.code }}</p>
            </div>
            <n-tag :type="skill.isActive ? 'success' : 'default'" round>
              {{ skill.isActive ? "启用" : "停用" }}
            </n-tag>
          </div>

          <div class="apple-header-meta" style="margin-bottom: 12px;">
            <span class="apple-badge">
              绑定类型：{{ skill.docType?.name ?? "未绑定" }}
            </span>
            <span class="apple-badge">工具数：{{ skill.tools.length }}</span>
          </div>

          <p class="apple-muted">
            {{ skill.description || "暂无描述，建议补充技能用途和适用场景。" }}
          </p>
        </article>
      </section>

      <section v-else class="apple-panel apple-empty">
        <div>
          <h3 style="margin-top: 0;">暂时没有技能</h3>
          <p class="apple-muted">Agent 路由虽然默认支持 thesis 技能，但数据库层面的技能配置仍建议同步维护。</p>
        </div>
      </section>
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { apiFetch } from "../../lib/api.js";

interface SkillRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  tools: string[];
  docType: {
    id: string;
    code: string;
    name: string;
  } | null;
}

const message = useMessage();
const skills = ref<SkillRecord[]>([]);
const loading = ref(true);
const activeCount = computed(() => skills.value.filter((item) => item.isActive).length);
const linkedDocTypes = computed(() => new Set(
  skills.value
    .map((item) => item.docType?.code)
    .filter((value): value is string => Boolean(value)),
).size);

onMounted(async () => {
  try {
    skills.value = await apiFetch<SkillRecord[]>("/admin/skills");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "技能列表加载失败");
  } finally {
    loading.value = false;
  }
});
</script>
