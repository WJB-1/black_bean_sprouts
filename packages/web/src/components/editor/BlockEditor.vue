<template>
  <article class="apple-block-card" :style="{ '--block-depth': String(depth) }">
    <header class="apple-block-header">
      <div>
        <p class="apple-kicker">{{ blockTypeLabel }}</p>
        <p class="apple-muted">ID {{ node.id }}</p>
      </div>
      <div class="apple-block-actions">
        <n-button size="small" quaternary :disabled="index === 0" @click="moveBlock(-1)">上移</n-button>
        <n-button size="small" quaternary :disabled="index >= siblingCount - 1" @click="moveBlock(1)">下移</n-button>
        <n-button size="small" quaternary :disabled="!canInsertBelow" @click="insertBelow">下方插入</n-button>
        <n-button size="small" type="error" tertiary @click="removeBlock">删除</n-button>
      </div>
    </header>

    <section v-if="sectionNode" class="apple-block-body">
      <div class="apple-field-row">
        <n-input v-model:value="sectionTitle" placeholder="章节标题" @blur="saveSection" />
        <n-select v-model:value="sectionLevel" :options="sectionLevelOptions" class="apple-level-select" />
        <n-button size="small" type="primary" @click="saveSection">保存</n-button>
      </div>
      <div class="apple-block-actions">
        <n-button size="small" @click="addParagraphChild">添加段落</n-button>
        <n-button size="small" @click="addSectionChild">添加子章节</n-button>
      </div>
    </section>

    <section v-else-if="paragraphNode" class="apple-block-body">
      <inline-text-editor
        v-model="paragraphText"
        placeholder="输入段落内容"
        :min-rows="4"
        :max-rows="14"
        @commit="saveParagraph"
      />
      <div class="apple-block-actions">
        <n-button size="small" type="primary" @click="saveParagraph">保存段落</n-button>
      </div>
    </section>

    <section v-else-if="abstractNode" class="apple-block-body">
      <div class="apple-field-row">
        <n-select v-model:value="abstractLanguage" :options="languageOptions" class="apple-level-select" />
        <n-input v-model:value="abstractKeywords" placeholder="关键词，逗号分隔" @blur="saveAbstract" />
        <n-button size="small" type="primary" @click="saveAbstract">保存摘要</n-button>
      </div>
      <div class="apple-block-actions">
        <n-button size="small" @click="addParagraphChild">添加摘要段落</n-button>
      </div>
    </section>

    <p v-else class="apple-muted">当前 UI 暂不支持编辑此块类型，右侧仍可预览。</p>

    <div v-if="childBlocks.length > 0" class="apple-block-children">
      <block-editor
        v-for="(child, childIndex) in childBlocks"
        :key="child.id"
        :node="child"
        :parent-id="node.id"
        :index="childIndex"
        :sibling-count="childBlocks.length"
        :depth="depth + 1"
        @apply="emit('apply', $event)"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { BlockNode, DocumentPatch, Paragraph, Section, Abstract } from "@black-bean-sprouts/doc-schema";
import { computed, ref, watch } from "vue";
import {
  createAbstractNode,
  createParagraphNode,
  createSectionNode,
  getEditableChildren,
  keywordsToText,
  textToKeywords,
} from "../../lib/doc-editor.js";
import { inlineNodesToText } from "../../lib/doc.js";
import InlineTextEditor from "./InlineTextEditor.vue";

defineOptions({ name: "BlockEditor" });

const props = defineProps<{
  node: BlockNode;
  parentId: string;
  index: number;
  siblingCount: number;
  depth: number;
}>();

const emit = defineEmits<{ apply: [patches: DocumentPatch[]] }>();

const sectionTitle = ref("");
const sectionLevel = ref<1 | 2 | 3 | 4 | 5>(1);
const paragraphText = ref("");
const abstractKeywords = ref("");
const abstractLanguage = ref<"zh" | "en">("zh");

const sectionNode = computed<Section | null>(() => props.node.type === "section" ? props.node : null);
const paragraphNode = computed<Paragraph | null>(() => props.node.type === "paragraph" ? props.node : null);
const abstractNode = computed<Abstract | null>(() => props.node.type === "abstract" ? props.node : null);
const childBlocks = computed(() => getEditableChildren(props.node));
const canInsertBelow = computed(() => props.parentId.length > 0);
const blockTypeLabel = computed(() => {
  if (sectionNode.value) return `章节 · H${sectionNode.value.attrs.level}`;
  if (paragraphNode.value) return "段落";
  if (abstractNode.value) return "摘要";
  return `块 · ${props.node.type}`;
});

watch(() => props.node, syncDrafts, { immediate: true, deep: true });

const sectionLevelOptions = [1, 2, 3, 4, 5].map((level) => ({ label: `H${level}`, value: level as 1 | 2 | 3 | 4 | 5 }));
const languageOptions = [
  { label: "中文", value: "zh" as const },
  { label: "English", value: "en" as const },
];

function syncDrafts(): void {
  if (sectionNode.value) {
    sectionTitle.value = sectionNode.value.attrs.title;
    sectionLevel.value = sectionNode.value.attrs.level;
  }
  if (paragraphNode.value) {
    paragraphText.value = inlineNodesToText(paragraphNode.value.content);
  }
  if (abstractNode.value) {
    abstractKeywords.value = keywordsToText(abstractNode.value.attrs.keywords);
    abstractLanguage.value = abstractNode.value.attrs.language;
  }
}

function saveSection(): void {
  if (!sectionNode.value) return;
  emit("apply", [{
    op: "update_block_attrs",
    id: sectionNode.value.id,
    attrs: { title: sectionTitle.value.trim() || "未命名章节", level: sectionLevel.value },
  }]);
}

function saveParagraph(): void {
  if (!paragraphNode.value) return;
  emit("apply", [{
    op: "update_text",
    paragraphId: paragraphNode.value.id,
    content: createParagraphNode(paragraphText.value).content,
  }]);
}

function saveAbstract(): void {
  if (!abstractNode.value) return;
  emit("apply", [{
    op: "update_block_attrs",
    id: abstractNode.value.id,
    attrs: {
      language: abstractLanguage.value,
      keywords: textToKeywords(abstractKeywords.value),
    },
  }]);
}

function addParagraphChild(): void {
  if (!sectionNode.value && !abstractNode.value) return;
  emit("apply", [{
    op: "insert_block",
    parentId: props.node.id,
    index: childBlocks.value.length,
    node: createParagraphNode(""),
  }]);
}

function addSectionChild(): void {
  if (!sectionNode.value) return;
  emit("apply", [{
    op: "insert_block",
    parentId: props.node.id,
    index: childBlocks.value.length,
    node: createSectionNode("新章节", Math.min(sectionNode.value.attrs.level + 1, 5) as 1 | 2 | 3 | 4 | 5),
  }]);
}

function insertBelow(): void {
  const nextNode = buildSiblingNode();
  if (!nextNode) return;
  emit("apply", [{
    op: "insert_block",
    parentId: props.parentId,
    index: props.index + 1,
    node: nextNode,
  }]);
}

function buildSiblingNode(): BlockNode | null {
  if (sectionNode.value) return createSectionNode("新章节", sectionNode.value.attrs.level);
  if (paragraphNode.value) return createParagraphNode("");
  if (abstractNode.value) return createAbstractNode(abstractNode.value.attrs.language);
  return null;
}

function moveBlock(offset: -1 | 1): void {
  const nextIndex = props.index + offset;
  if (nextIndex < 0 || nextIndex >= props.siblingCount) return;
  emit("apply", [{
    op: "move_block",
    id: props.node.id,
    newParentId: props.parentId,
    newIndex: nextIndex,
  }]);
}

function removeBlock(): void {
  emit("apply", [{ op: "remove_block", id: props.node.id }]);
}
</script>
