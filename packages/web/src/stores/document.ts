import { defineStore } from "pinia";
import { ref } from "vue";
import { apiFetch } from "../lib/api.js";

interface DocInfo {
  id: string;
  title: string | null;
  status: string;
  docTypeId: string;
  createdAt: string;
  updatedAt: string;
}

interface DocDetail extends DocInfo {
  content: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export const useDocumentStore = defineStore("document", () => {
  const documents = ref<DocInfo[]>([]);
  const currentDoc = ref<DocDetail | null>(null);
  const loading = ref(false);

  async function fetchList(): Promise<void> {
    loading.value = true;
    try {
      documents.value = await apiFetch<DocInfo[]>("/documents");
    } finally {
      loading.value = false;
    }
  }

  async function fetchDoc(id: string): Promise<void> {
    loading.value = true;
    try {
      currentDoc.value = await apiFetch<DocDetail>(`/documents/${id}`);
    } finally {
      loading.value = false;
    }
  }

  async function createDocument(docTypeId: string, title?: string): Promise<DocDetail> {
    const doc = await apiFetch<DocDetail>("/documents", {
      method: "POST",
      body: JSON.stringify({ docTypeId, title }),
    });
    documents.value.unshift(doc);
    return doc;
  }

  async function updateContent(id: string, content: unknown): Promise<void> {
    await apiFetch(`/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  }

  async function deleteDocument(id: string): Promise<void> {
    await apiFetch(`/documents/${id}`, { method: "DELETE" });
    documents.value = documents.value.filter((d) => d.id !== id);
  }

  async function renderDocument(id: string): Promise<Blob> {
    const res = await fetch(`/api/documents/${id}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("bbs_access_token")}`,
      },
    });
    if (!res.ok) {
      throw new Error("渲染失败");
    }
    return res.blob();
  }

  return {
    documents,
    currentDoc,
    loading,
    fetchList,
    fetchDoc,
    createDocument,
    updateContent,
    deleteDocument,
    renderDocument,
  };
});
