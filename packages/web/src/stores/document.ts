import type { Doc } from "@black-bean-sprouts/doc-schema";
import { defineStore } from "pinia";
import { ref } from "vue";
import { apiFetch } from "../lib/api.js";
import { getAccessToken } from "../lib/token.js";

interface DocumentSummary {
  id: string;
  title: string | null;
  status: string;
  docTypeId: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentDetail extends DocumentSummary {
  content: Doc;
  meta: Record<string, unknown>;
}

async function readBinaryError(res: Response): Promise<string> {
  const raw = await res.text();

  if (!raw) {
    return `请求失败 (${res.status})`;
  }

  try {
    const body = JSON.parse(raw) as { error?: { message?: string } };
    return body.error?.message ?? raw;
  } catch {
    return raw;
  }
}

export const useDocumentStore = defineStore("document", () => {
  const documents = ref<DocumentSummary[]>([]);
  const currentDoc = ref<DocumentDetail | null>(null);
  const loading = ref(false);

  async function fetchList(): Promise<void> {
    loading.value = true;
    try {
      documents.value = await apiFetch<DocumentSummary[]>("/documents");
    } finally {
      loading.value = false;
    }
  }

  async function fetchDoc(id: string): Promise<void> {
    loading.value = true;
    try {
      currentDoc.value = await apiFetch<DocumentDetail>(`/documents/${id}`);
    } catch (err) {
      currentDoc.value = null;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createDocument(docTypeId: string, title?: string): Promise<DocumentDetail> {
    const doc = await apiFetch<DocumentDetail>("/documents", {
      method: "POST",
      body: JSON.stringify({ docTypeId, title }),
    });
    documents.value.unshift(doc);
    return doc;
  }

  async function updateContent(id: string, content: Doc): Promise<void> {
    const updated = await apiFetch<DocumentDetail>(`/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });

    currentDoc.value = updated;
    documents.value = documents.value.map((doc) => (
      doc.id === updated.id
        ? {
          id: updated.id,
          title: updated.title,
          status: updated.status,
          docTypeId: updated.docTypeId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        }
        : doc
    ));
  }

  async function deleteDocument(id: string): Promise<void> {
    await apiFetch(`/documents/${id}`, { method: "DELETE" });
    documents.value = documents.value.filter((doc) => doc.id !== id);
    if (currentDoc.value?.id === id) {
      currentDoc.value = null;
    }
  }

  async function renderDocument(id: string, signal?: AbortSignal): Promise<Blob> {
    const token = getAccessToken();
    if (!token) {
      throw new Error("请先登录");
    }

    const res = await fetch(`/api/documents/${id}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ format: "docx" }),
      ...(signal !== undefined && { signal }),
    });

    if (!res.ok) {
      throw new Error(await readBinaryError(res));
    }

    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      throw new Error(await readBinaryError(res));
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
