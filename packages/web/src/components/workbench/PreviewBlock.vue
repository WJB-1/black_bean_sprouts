<template>
  <div class="preview-block" :class="`preview-block--${block.type}`">
    <!-- 标题 -->
    <template v-if="block.type === 'heading'">
      <component
        :is="`h${block.level}`"
        class="preview-heading"
        :class="`preview-heading--${block.level}`"
        :style="headingStyle"
      >
        {{ inlineText(block.children) }}
      </component>
    </template>

    <!-- 段落 -->
    <template v-else-if="block.type === 'paragraph'">
      <p class="preview-paragraph" :style="paragraphStyle">
        <span v-for="(child, i) in block.children" :key="i">
          <span v-if="child.type === 'text'">{{ child.text }}</span>
          <span v-else-if="child.type === 'formula-inline'" class="preview-formula-inline">{{ child.latex }}</span>
          <br v-else-if="child.type === 'hardBreak'" />
        </span>
      </p>
    </template>

    <!-- 章节 -->
    <template v-else-if="block.type === 'section'">
      <div class="preview-section">
        <h3 class="preview-section-title" :style="headingStyle">{{ block.title }}</h3>
        <PreviewBlock
          v-for="child in block.children"
          :key="child.id"
          :block="child"
          :style-config="styleConfig"
        />
      </div>
    </template>

    <!-- 摘要 -->
    <template v-else-if="block.type === 'abstract'">
      <div class="preview-abstract">
        <div class="preview-abstract-label">摘 要</div>
        <p
          v-for="(para, i) in block.children"
          :key="i"
          class="preview-paragraph"
          :style="paragraphStyle"
        >
          {{ inlineText(para.children) }}
        </p>
      </div>
    </template>

    <!-- 公式 -->
    <template v-else-if="block.type === 'formula'">
      <div class="preview-formula">
        <code>{{ block.latex }}</code>
      </div>
    </template>

    <!-- 表格 -->
    <template v-else-if="block.type === 'table'">
      <div class="preview-table-wrapper">
        <table class="preview-table">
          <thead v-if="block.headerRow">
            <tr>
              <th v-for="(cell, i) in block.headerRow.cells" :key="i">{{ cellText(cell) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in block.rows" :key="i">
              <td v-for="(cell, j) in row.cells" :key="j">{{ cellText(cell) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 图片 -->
    <template v-else-if="block.type === 'figure'">
      <figure class="preview-figure">
        <div class="preview-figure-placeholder">🖼️ {{ block.alt || '图片' }}</div>
        <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
      </figure>
    </template>

    <!-- 参考文献 -->
    <template v-else-if="block.type === 'reference-list'">
      <div class="preview-references">
        <div class="preview-references-label">参考文献</div>
        <ol>
          <li v-for="item in block.items" :key="item.key">
            <span class="ref-key">[{{ item.key }}]</span>
            {{ item.title }}
            <span v-if="item.authors" class="ref-authors">{{ item.authors }}</span>
          </li>
        </ol>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BlockNode } from "@black-bean-sprouts/doc-schema";

const props = defineProps<{
  block: BlockNode;
  styleConfig: {
    bodyFontSizePt: number;
    lineSpacing: number;
    marginTopMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
    marginRightMm: number;
  };
}>();

const paragraphStyle = computed(() => ({
  fontSize: `${props.styleConfig.bodyFontSizePt}pt`,
  lineHeight: props.styleConfig.lineSpacing,
  textAlign: "justify" as const,
}));

const headingStyle = computed(() => ({
  lineHeight: props.styleConfig.lineSpacing,
}));

function inlineText(children: readonly { type: string; text?: string; latex?: string }[]): string {
  return children
    .map((item) => {
      if (item.type === "text") return item.text ?? "";
      if (item.type === "formula-inline") return item.latex ?? "";
      if (item.type === "hardBreak") return " ";
      return "";
    })
    .join("")
    .trim();
}

function cellText(cell: { children: readonly { type: "paragraph"; id: string; children: readonly { type: string; text?: string }[] }[] }): string {
  return cell.children.map((p) => inlineText(p.children)).join(" ");
}
</script>

<style scoped>
.preview-block {
  margin-bottom: 0.5em;
}

.preview-paragraph {
  margin: 0 0 0.8em;
  text-indent: 2em;
  color: #333;
}

.preview-heading {
  margin: 1.2em 0 0.6em;
  font-weight: 700;
  color: #1a1a1a;
}

.preview-heading--1 {
  font-size: 1.6em;
  text-align: center;
}

.preview-heading--2 {
  font-size: 1.3em;
}

.preview-heading--3 {
  font-size: 1.15em;
}

.preview-heading--4 {
  font-size: 1.05em;
}

.preview-section {
  margin-bottom: 1em;
}

.preview-section-title {
  font-size: 1.2em;
  font-weight: 700;
  margin: 1em 0 0.5em;
  color: var(--color-primary);
}

.preview-abstract {
  margin: 1em 0;
  padding: 1em;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-abstract-label {
  text-align: center;
  font-weight: 700;
  font-size: 1.1em;
  margin-bottom: 0.5em;
}

.preview-abstract .preview-paragraph {
  text-indent: 2em;
}

.preview-formula {
  margin: 1em 0;
  padding: 1em;
  text-align: center;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-formula code {
  font-family: var(--font-mono);
  font-size: 0.95em;
  color: #333;
}

.preview-formula-inline {
  font-family: var(--font-mono);
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}

.preview-table-wrapper {
  margin: 1em 0;
  overflow-x: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.preview-table th,
.preview-table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.preview-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.preview-table tr:nth-child(even) {
  background: #fafafa;
}

.preview-figure {
  margin: 1em 0;
  text-align: center;
}

.preview-figure-placeholder {
  padding: 2em;
  background: #f5f5f5;
  border-radius: 8px;
  color: #999;
  font-size: 0.9em;
}

.preview-figure figcaption {
  margin-top: 0.5em;
  font-size: 0.85em;
  color: #666;
}

.preview-references {
  margin: 1em 0;
}

.preview-references-label {
  font-weight: 700;
  font-size: 1.1em;
  margin-bottom: 0.5em;
  text-align: center;
}

.preview-references ol {
  padding-left: 2em;
  font-size: 0.9em;
  line-height: 1.8;
}

.preview-references li {
  margin-bottom: 0.3em;
}

.ref-key {
  font-weight: 600;
  margin-right: 0.3em;
}

.ref-authors {
  color: #666;
  font-size: 0.9em;
}

.preview-unknown {
  padding: 0.5em;
  background: #fff3cd;
  border-radius: 4px;
  font-size: 0.85em;
  color: #856404;
}
</style>
