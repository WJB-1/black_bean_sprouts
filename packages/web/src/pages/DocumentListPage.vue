<template>
  <div class="apple-page">
    <div class="apple-shell">
      <header class="apple-panel apple-header">
        <div>
          <p class="apple-kicker">Document Workspace</p>
          <h1 class="apple-title">文档中心</h1>
          <p class="apple-subtitle">欢迎回来，{{ displayName }}。这里集中管理你的医学写作与导出任务。</p>
        </div>
        <div class="apple-actions">
          <span class="apple-badge">上次更新：{{ lastUpdatedLabel }}</span>
          <n-button @click="router.push({ path: '/admin' })">后台配置</n-button>
          <n-button tertiary @click="handleLogout">退出登录</n-button>
        </div>
      </header>

      <section class="apple-grid apple-stats">
        <article class="apple-panel apple-stat">
          <p class="apple-stat-value">{{ docStore.documents.length }}</p>
          <p class="apple-stat-label">文档总数</p>
        </article>
        <article class="apple-panel apple-stat">
          <p class="apple-stat-value">{{ renderingCount }}</p>
          <p class="apple-stat-label">渲染进行中</p>
        </article>
        <article class="apple-panel apple-stat">
          <p class="apple-stat-value">{{ completedCount }}</p>
          <p class="apple-stat-label">已成功导出</p>
        </article>
      </section>

      <section class="apple-panel apple-toolbar">
        <div>
          <p class="apple-kicker">Library</p>
          <h2 class="apple-section-title" style="margin: 0;">你的文档库</h2>
          <p class="apple-muted">支持毕业论文、科研论文等模板，先选文档类型再开始写作。</p>
        </div>
        <div class="apple-actions">
          <n-button @click="refreshDocuments" :loading="docStore.loading">刷新列表</n-button>
          <n-button type="primary" @click="openCreateModal">新建文档</n-button>
        </div>
      </section>

      <n-spin :show="docStore.loading">
        <section v-if="docStore.documents.length > 0" class="apple-card-grid">
          <article
            v-for="doc in docStore.documents"
            :key="doc.id"
            class="apple-panel apple-card"
          >
            <div class="apple-card-head">
              <div>
                <h3 style="margin: 0 0 6px; font-size: 22px;">
                  {{ doc.title || "未命名文档" }}
                </h3>
                <p class="apple-muted">
                  {{ resolveDocTypeName(doc.docTypeId) }} · 创建于 {{ formatDateTime(doc.createdAt) }}
                </p>
              </div>
              <n-tag :type="formatStatusType(doc.status)" round>
                {{ formatStatusLabel(doc.status) }}
              </n-tag>
            </div>

            <div class="apple-header-meta" style="margin-bottom: 18px;">
              <span class="apple-badge">ID: {{ doc.id }}</span>
              <span class="apple-badge">最近更新：{{ formatDateTime(doc.updatedAt) }}</span>
            </div>

            <div class="apple-actions">
              <n-button @click="openDocument(doc.id)">继续编辑</n-button>
              <n-popconfirm
                positive-text="删除"
                negative-text="取消"
                @positive-click="handleDelete(doc.id)"
              >
                <template #trigger>
                  <n-button type="error" tertiary>删除</n-button>
                </template>
                删除后无法恢复，确认继续吗？
              </n-popconfirm>
            </div>
          </article>
        </section>

        <section v-else class="apple-panel apple-empty">
          <div>
            <p class="apple-kicker">Empty Library</p>
            <h2 class="apple-section-title">还没有文档</h2>
            <p class="apple-muted" style="margin-bottom: 18px;">
              先创建一份文档，右侧 Agent 面板就可以开始帮你写作、补全和渲染。
            </p>
            <n-button type="primary" @click="openCreateModal">创建第一份文档</n-button>
          </div>
        </section>
      </n-spin>

      <n-modal v-model:show="showCreate" preset="card" :mask-closable="true" style="padding: 0;">
        <div class="apple-panel apple-modal-card">
          <p class="apple-kicker">Create Document</p>
          <h2 class="apple-section-title" style="margin-top: 0;">选择文档类型</h2>
          <p class="apple-muted">
            当前选择：{{ selectedDocTypeName }}。标题可留空，系统会自动使用默认名称。
          </p>

          <div class="apple-type-grid">
            <button
              v-for="docType in activeDocTypes"
              :key="docType.id"
              type="button"
              class="apple-type-card"
              :class="{ 'is-selected': selectedDocType === docType.code }"
              @click="selectedDocType = docType.code"
            >
              <strong>{{ docType.name }}</strong>
              <p class="apple-muted" style="margin-top: 8px;">{{ docType.description || docType.code }}</p>
            </button>
          </div>

          <n-input
            v-model:value="newTitle"
            placeholder="输入文档标题（可选）"
            :maxlength="100"
            show-count
          />

          <div class="apple-actions" style="justify-content: flex-end; margin-top: 18px;">
            <n-button @click="showCreate = false">取消</n-button>
            <n-button type="primary" :loading="creating" @click="handleCreate">
              创建文档
            </n-button>
          </div>
        </div>
      </n-modal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { useRouter } from "vue-router";
import { apiFetch } from "../lib/api.js";
import { formatDateTime, formatStatusLabel, formatStatusType } from "../lib/format.js";
import { useAuthStore } from "../stores/auth.js";
import { useDocumentStore } from "../stores/document.js";

interface CatalogDocType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const docStore = useDocumentStore();

const docTypes = ref<CatalogDocType[]>([]);
const showCreate = ref(false);
const newTitle = ref("");
const selectedDocType = ref("thesis");
const creating = ref(false);

const displayName = computed(() => (
  authStore.user?.nickname || authStore.user?.phone || "创作者"
));

const activeDocTypes = computed(() => docTypes.value.filter((item) => item.isActive));
const renderingCount = computed(() => docStore.documents.filter((doc) => doc.status === "RENDERING").length);
const completedCount = computed(() => docStore.documents.filter((doc) => doc.status === "COMPLETED").length);
const lastUpdatedLabel = computed(() => {
  const latest = docStore.documents[0];
  return latest ? formatDateTime(latest.updatedAt) : "暂无";
});
const selectedDocTypeName = computed(() => (
  activeDocTypes.value.find((item) => item.code === selectedDocType.value)?.name ?? "毕业论文"
));

onMounted(() => {
  void bootstrap();
});

async function bootstrap(): Promise<void> {
  if (!authStore.user) {
    await authStore.fetchUser();
  }

  await Promise.allSettled([loadDocTypes(), docStore.fetchList()]);
}

async function loadDocTypes(): Promise<void> {
  try {
    docTypes.value = await apiFetch<CatalogDocType[]>("/admin/doc-types");
    const preferred = activeDocTypes.value[0];
    if (preferred) {
      selectedDocType.value = preferred.code;
    }
  } catch (err) {
    message.warning(err instanceof Error ? err.message : "文档类型加载失败，将使用默认类型");
  }
}

function resolveDocTypeName(docTypeId: string): string {
  return docTypes.value.find((item) => item.id === docTypeId)?.name ?? "未知类型";
}

function openCreateModal(): void {
  showCreate.value = true;
}

function openDocument(id: string): void {
  void router.push({ name: "document-edit", params: { id } });
}

async function refreshDocuments(): Promise<void> {
  try {
    await docStore.fetchList();
    message.success("列表已刷新");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "刷新失败");
  }
}

async function handleCreate(): Promise<void> {
  creating.value = true;
  try {
    const title = newTitle.value.trim() || undefined;
    const doc = await docStore.createDocument(selectedDocType.value, title);
    showCreate.value = false;
    newTitle.value = "";
    message.success("文档已创建");
    void router.push({ name: "document-edit", params: { id: doc.id } });
  } catch (err) {
    message.error(err instanceof Error ? err.message : "创建文档失败");
  } finally {
    creating.value = false;
  }
}

async function handleDelete(id: string): Promise<void> {
  try {
    await docStore.deleteDocument(id);
    message.success("文档已删除");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "删除失败");
  }
}

function handleLogout(): void {
  authStore.logout();
  void router.push({ name: "login" });
}
</script>
