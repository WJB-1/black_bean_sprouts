import { defineStore } from "pinia";
import { ref } from "vue";
import type { Doc, DocumentPatchBatch } from "@black-bean-sprouts/doc-schema";
import { apiFetch } from "../lib/api.js";

export const useDocumentStore = defineStore("document", () => {
  const doc = ref<Doc | null>(null);
  const loading = ref(false);

  async function loadDocument(id: string) {
    loading.value = true;
    try {
      const res = await apiFetch<{ id: string; version: number; content: Doc }>("/documents/" + id);
      doc.value = { ...res.content, version: res.version };
    } finally { loading.value = false; }
  }

  async function applyPatches(batch: DocumentPatchBatch) {
    if (!doc.value) return;
    const res = await apiFetch<{ ok: boolean; version: number }>(
      "/documents/" + ((doc.value as any).id) + "/patches",
      { method: "PATCH", body: JSON.stringify(batch) }
    );
    if (res.ok) doc.value = { ...doc.value, version: res.version };
  }

  return { doc, loading, loadDocument, applyPatches };
});
