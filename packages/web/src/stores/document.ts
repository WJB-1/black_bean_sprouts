import { defineStore } from "pinia";
import { ref } from "vue";
import type { Doc, DocumentPatchBatch } from "@black-bean-sprouts/doc-schema";
import { apiFetch } from "../lib/api.js";

export const useDocumentStore = defineStore("document", () => {
  const doc = ref<Doc | null>(null);
  const documentId = ref<string | null>(null);
  const loading = ref(false);

  async function loadDocument(id: string) {
    loading.value = true;
    try {
      const res = await apiFetch<{ id: string; version: number; content: Doc }>("/documents/" + id);
      documentId.value = res.id;
      doc.value = { ...res.content, version: res.version };
    } finally {
      loading.value = false;
    }
  }

  async function applyPatches(batch: DocumentPatchBatch) {
    if (!doc.value || !documentId.value) return;
    const res = await apiFetch<{ ok: boolean; version: number }>(
      "/documents/" + documentId.value + "/patches",
      { method: "PATCH", body: JSON.stringify(batch) }
    );
    if (res.ok) doc.value = { ...doc.value, version: res.version };
  }

  function replaceDocument(nextDoc: Doc, nextDocumentId?: string) {
    doc.value = nextDoc;
    if (typeof nextDocumentId === "string" && nextDocumentId.trim()) {
      documentId.value = nextDocumentId;
    }
  }

  return { doc, documentId, loading, loadDocument, applyPatches, replaceDocument };
});
