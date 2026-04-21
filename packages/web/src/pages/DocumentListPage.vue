<template>
  <div style="max-width: 900px; margin: 0 auto; padding: 24px">
    <n-space justify="space-between" align="center">
      <h2>我的文档</h2>
      <n-button type="primary" @click="showCreate = true">新建文档</n-button>
    </n-space>

    <n-spin :show="docStore.loading">
      <n-empty v-if="!docStore.loading && !docStore.documents.length" description="暂无文档" style="margin-top: 40px">
        <template #extra>
          <n-button size="small" @click="showCreate = true">创建第一个文档</n-button>
        </template>
      </n-empty>
      <n-list v-else-if="docStore.documents.length">
        <n-list-item v-for="doc in docStore.documents" :key="doc.id">
          <n-thing :title="doc.title ?? '未命名文档'">
            <template #description>
              <n-space>
                <n-tag size="small">{{ doc.status }}</n-tag>
                <span style="color: #999">{{ formatDate(doc.updatedAt) }}</span>
              </n-space>
            </template>
            <template #action>
              <n-space>
                <n-button @click="router.push({ name: 'document-edit', params: { id: doc.id } })">编辑</n-button>
                <n-popconfirm
                  @positive-click="handleDelete(doc.id)"
                  :positive-text="'确认删除'"
                  :negative-text="'取消'"
                >
                  <template #trigger>
                    <n-button type="error" ghost>删除</n-button>
                  </template>
                  确认要删除这个文档吗？此操作不可恢复。
                </n-popconfirm>
              </n-space>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-spin>

    <n-modal v-model:show="showCreate" :mask-closable="true" :closable="true">
      <n-card title="新建文档" style="width: 400px">
        <n-space vertical>
          <n-input v-model:value="newTitle" placeholder="文档标题" :maxlength="100" show-count />
          <n-space :justify="'end'">
            <n-button @click="showCreate = false">取消</n-button>
            <n-button type="primary" @click="handleCreate" :disabled="!newTitle.trim()" :loading="creating">
              创建
            </n-button>
          </n-space>
        </n-space>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useMessage, NButton, NSpace, NSpin, NEmpty, NList, NListItem, NThing, NTag, NModal, NCard, NPopconfirm } from "naive-ui";
import { useDocumentStore } from "../stores/document.js";

const router = useRouter();
const message = useMessage();
const docStore = useDocumentStore();
const showCreate = ref(false);
const newTitle = ref("");
const creating = ref(false);

onMounted(() => { void fetchDocuments(); });

async function fetchDocuments(): Promise<void> {
  try {
    await docStore.fetchList();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "加载文档列表失败";
    message.error(errorMessage);
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

async function handleCreate(): Promise<void> {
  const title = newTitle.value.trim();
  if (!title) return;

  creating.value = true;
  try {
    const doc = await docStore.createDocument("thesis", title);
    showCreate.value = false;
    newTitle.value = "";
    message.success("文档创建成功");
    void router.push({ name: "document-edit", params: { id: doc.id } });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "创建失败";
    message.error(errorMessage);
  } finally {
    creating.value = false;
  }
}

async function handleDelete(id: string): Promise<void> {
  try {
    await docStore.deleteDocument(id);
    message.success("已删除");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "删除失败";
    message.error(errorMessage);
    // Refresh list to ensure UI is in sync
    void fetchDocuments();
  }
}
</script>
