// @doc-schema-version: 1.0.0
import type { Doc, DocumentPatch } from "@black-bean-sprouts/doc-schema";
import { defineStore } from "pinia";
import { ref } from "vue";
import { apiFetch } from "../lib/api.js";
import { getAccessToken } from "../lib/token.js";

type DocumentSummary = {
  id: string;
  title: string | null;
  status: string;
  docTypeId: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentDetail = DocumentSummary & {
  content: Doc;
  meta: Record<string, unknown>;
};

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
    } catch (error) {
      currentDoc.value = null;
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function createDocument(docTypeId: string, title?: string): Promise<DocumentDetail> {
    const document = await apiFetch<DocumentDetail>("/documents", {
      method: "POST",
      body: JSON.stringify({ docTypeId, title }),
    });
    documents.value.unshift(toSummary(document));
    return document;
  }

  async function updateContent(id: string, content: Doc): Promise<void> {
    const document = await apiFetch<DocumentDetail>(`/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
    syncDocument(document);
  }

  async function applyPatches(id: string, patches: readonly DocumentPatch[]): Promise<DocumentDetail> {
    const document = await apiFetch<DocumentDetail>(`/documents/${id}/patches`, {
      method: "PATCH",
      body: JSON.stringify({ patches }),
    });
    syncDocument(document);
    return document;
  }

  async function deleteDocument(id: string): Promise<void> {
    await apiFetch(`/documents/${id}`, { method: "DELETE" });
    documents.value = documents.value.filter((document) => document.id !== id);
    if (currentDoc.value?.id === id) {
      currentDoc.value = null;
    }
  }

  async function renderDocument(id: string, signal?: AbortSignal): Promise<Blob> {
    const token = getAccessToken();
    if (!token) {
      throw new Error("请先登录");
    }

    const response = await fetch(`/api/documents/${id}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ format: "docx" }),
      ...(signal !== undefined && { signal }),
    });

    if (!response.ok) {
      throw new Error(await readBinaryError(response));
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(await readBinaryError(response));
    }
    return response.blob();
  }

  function syncDocument(document: DocumentDetail): void {
    currentDoc.value = document;
    documents.value = documents.value.some((item) => item.id === document.id)
      ? documents.value.map((item) => item.id === document.id ? toSummary(document) : item)
      : [toSummary(document), ...documents.value];
  }

  return {
    documents,
    currentDoc,
    loading,
    fetchList,
    fetchDoc,
    createDocument,
    updateContent,
    applyPatches,
    deleteDocument,
    renderDocument,
  };
});

function toSummary(document: DocumentDetail): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    status: document.status,
    docTypeId: document.docTypeId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function readBinaryError(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) {
    return `Request failed (${response.status})`;
  }

  try {
    const body = JSON.parse(raw) as { error?: { message?: string } };
    return body.error?.message ?? raw;
  } catch {
    return raw;
  }
}
