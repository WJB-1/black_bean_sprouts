<template>
  <section class="apple-editor-pane">
    <header class="apple-subpanel-header">
      <div>
        <p class="apple-kicker">Patch Editor</p>
        <h2 class="apple-section-title">结构块编辑</h2>
      </div>
      <div class="apple-block-actions">
        <n-button size="small" @click="addAbstract">添加摘要</n-button>
        <n-button size="small" @click="addParagraph">添加段落</n-button>
        <n-button size="small" type="primary" @click="addSection">添加章节</n-button>
      </div>
    </header>

    <section v-if="blocks.length > 0" class="apple-block-list">
      <block-editor
        v-for="(block, index) in blocks"
        :key="block.id"
        :node="block"
        parent-id="root"
        :index="index"
        :sibling-count="blocks.length"
        :depth="0"
        @apply="emit('apply', $event)"
      />
    </section>

    <section v-else class="apple-empty apple-panel-soft">
      <div>
        <p class="apple-kicker">Empty Draft</p>
        <p class="apple-muted">先创建根章节、摘要或段落，所有修改都会转换成 `DocumentPatch[]`。</p>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import type { BlockNode, DocumentPatch } from "@black-bean-sprouts/doc-schema";
import { createAbstractNode, createParagraphNode, createSectionNode } from "../../lib/doc-editor.js";
import BlockEditor from "./BlockEditor.vue";

const props = defineProps<{ blocks: BlockNode[] }>();
const emit = defineEmits<{ apply: [patches: DocumentPatch[]] }>();

function addSection(): void {
  emit("apply", [{ op: "insert_block", parentId: "root", index: props.blocks.length, node: createSectionNode("新章节") }]);
}

function addParagraph(): void {
  emit("apply", [{ op: "insert_block", parentId: "root", index: props.blocks.length, node: createParagraphNode("") }]);
}

function addAbstract(): void {
  emit("apply", [{ op: "insert_block", parentId: "root", index: props.blocks.length, node: createAbstractNode("zh") }]);
}
</script>
