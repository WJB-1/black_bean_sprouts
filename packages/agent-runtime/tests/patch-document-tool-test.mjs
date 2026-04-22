#!/usr/bin/env node
import { patchDocumentTool } from "../dist/index.js";

const applied = [];
const result = await patchDocumentTool.execute({
  patches: [
    {
      op: "update_meta",
      meta: {
        title: "Patched by Tool",
      },
    },
  ],
}, {
  docId: "doc-1",
  userId: "user-1",
  sessionId: "session-1",
  services: {
    prisma: null,
    loadDocument: async () => ({}),
    saveDocument: async () => undefined,
    applyDocumentPatches: async (_docId, patches) => {
      applied.push(...patches);
      return { title: "Patched by Tool" };
    },
    submitRenderJob: async () => "job-1",
  },
});

if (result.llmVisible.status !== "success") {
  throw new Error("patch_document should succeed");
}
if (applied.length !== 1) {
  throw new Error("patch_document did not forward patches to services.applyDocumentPatches");
}

console.log("PASS: patch_document tool smoke succeeded");
