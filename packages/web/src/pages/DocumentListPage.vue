<template>
  <div style="max-width: 900px; margin: 0 auto; padding: 24px">
    <n-space justify="space-between" align="center">
      <h2>我的文档</h2>
      <n-button type="primary" @click="showCreate = true">新建文档</n-button>
    </n-space>

    <n-spin :show="docStore.loading">
      <n-empty v-if="!docStore.documents.length" description="暂无文档" style="margin-top: 40px" />
      <n-list v-else>
        <n-list-item v-for="doc in docStore.documents" :key="doc.id">
          <n-thing :title="doc.title ?? '未命名文档'">
            <template #description>
              <n-space>
                <n-tag size="small">{{ doc.status }}</n-tag>
                <span style="color: #999">{{ new Date(doc.updatedAt).toLocaleString() }}</span>
              </n-space>
            </template>
            <template #action>
              <n-space>
                <n-button @click="router.push({ name: 'document-edit', params: { id: doc.id } })">编辑</n-button>
                <n-button type="error" ghost @click="handleDelete(doc.id)">删除</n-button>
              </n-space>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-spin>

    <n-modal v-model:show="showCreate">
      <n-card title="新建文档" style="width: 400px">
        <n-space vertical>
          <n-input v-model:value="newTitle" placeholder="文档标题" />
          <n-button type="primary" block @click="handleCreate" :disabled="!newTitle">创建</n-button>
        </n-space>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useMessage, NButton, NSpace, NSpin, NEmpty, NList, NListItem, NThing, NTag, NModal, NCard, type MessageReactive } from "naive-ui";
import { useDocumentStore } from "../stores/document.js";

const router = useRouter();
const message = useMessage();
const docStore = useDocumentStore();
const showCreate = ref(false);
const newTitle = ref("");

onMounted(() => { void docStore.fetchList(); });

async function handleCreate(): Promise<void> {
  try {
    const doc = await docStore.createDocument("thesis", newTitle.value);
    showCreate.value = false;
    newTitle.value = "";
    void router.push({ name: "document-edit", params: { id: doc.id } });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "创建失败";
    message.error(errorMessage);
  }
}

async function handleDelete(id: string): Promise<void> {
  try {
    await docStore.deleteDocument(id);
    message.success("已删除");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "删除失败";
    message.error(errorMessage);
  }
}
</script>
