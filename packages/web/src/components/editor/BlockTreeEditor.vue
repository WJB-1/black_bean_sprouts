<template>
  <div class="block-tree-editor">
    <div v-if="!editor" class="loading">加载编辑器...</div>
    <div v-else class="editor-container">
      <editor-content :editor="editor" />
      <SlashMenu
        :visible="slashMenuVisible"
        :coords="slashMenuCoords"
        parent-id="root"
        :insert-index="0"
        @close="slashMenuVisible = false"
        @patch="handleSlashPatch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import SlashMenu from "./menus/SlashMenu.vue";
import { useDocumentStore } from "../../stores/document.js";
import { PatchFirstPlugin } from "./plugins/PatchFirstPlugin.js";
import { createBatch } from "@black-bean-sprouts/doc-schema";
import type { DocumentPatch } from "@black-bean-sprouts/doc-schema";

const props = defineProps<{ documentId?: string }>();
const store = useDocumentStore();

const slashMenuVisible = ref(false);
const slashMenuCoords = ref({ x: 0, y: 0 });

const editor = useEditor({
  extensions: [StarterKit],
  content: "<p>开始编辑文档...</p>",
  editorProps: {
    handleKeyDown: (_view: any, event: KeyboardEvent) => {
      if (event.key === "/" && !slashMenuVisible.value && editor.value) {
        // Get cursor coords from editor
        const { from } = editor.value.state.selection;
        const coords = editor.value.view.coordsAtPos(from);
        slashMenuCoords.value = { x: coords.left, y: coords.bottom };
        slashMenuVisible.value = true;
        return false;
      }
      if (event.key === "Escape") {
        slashMenuVisible.value = false;
      }
      return false;
    },
  },
});

// PatchFirstPlugin - connect to store
let plugin: PatchFirstPlugin | null = null;

onMounted(async () => {
  if (props.documentId) {
    await store.loadDocument(props.documentId);
  }
  if (editor.value && store.doc) {
    plugin = new PatchFirstPlugin(editor.value, {
      getDoc: () => store.doc!,
      onPatches: (batch) => {
        store.applyPatches(batch).catch((err) => console.error("Patch failed:", err));
      },
    });
  }
});

function handleSlashPatch(patches: readonly DocumentPatch[]) {
  slashMenuVisible.value = false;
  if (!store.doc) return;
  const batch = createBatch(store.doc.version, patches, "user");
  store.applyPatches(batch).catch((err) => console.error("SlashMenu patch failed:", err));
}

onBeforeUnmount(() => {
  plugin?.destroy();
  editor.value?.destroy();
});
</script>

<style scoped>
.block-tree-editor { height: 100%; display: flex; flex-direction: column; }
.editor-container { flex: 1; position: relative; }
.loading { padding: 2rem; color: #666; }
</style>
