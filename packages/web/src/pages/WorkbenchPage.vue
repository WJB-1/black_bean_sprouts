<template>
  <div class="workbench-page">
    <header class="toolbar">
      <div>
        <h1 class="logo">黑豆芽文档工作台</h1>
        <p class="subtitle">把未整理原稿整理成结构化文档，再导出 `DOCX` / `LaTeX`。</p>
      </div>
      <nav class="toolbar-nav">
        <router-link to="/workbench">工作台</router-link>
        <router-link to="/editor/new">编辑器</router-link>
        <router-link to="/admin">后台</router-link>
      </nav>
    </header>

    <main class="layout">
      <section
        class="panel input-panel"
        :class="{ 'panel--dragging': dragActive }"
        @dragenter.prevent="dragActive = true"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div class="panel-header">
          <h2>原稿输入</h2>
          <div class="panel-header-actions">
            <button class="ghost-btn" type="button" @click="loadExampleDraft">载入示例</button>
            <button class="ghost-btn" type="button" :disabled="!canClear" @click="clearWorkbench">清空</button>
            <label class="upload-btn">
              <input
                type="file"
                accept=".txt,.text,.md,.markdown,.tex,.csv,.json,.yaml,.yml,.html,.docx"
                @change="handleFilePick"
              />
              导入文本文件
            </label>
          </div>
        </div>

        <label class="field">
          <span>候选标题</span>
          <input v-model="title" class="text-input" placeholder="没有标题时可在这里给一个" />
        </label>

        <label class="field field--grow">
          <span>未整理原稿</span>
          <textarea
            v-model="rawText"
            class="text-area"
            placeholder="把原稿直接贴进来，或导入 .txt/.md/.tex 等文本文件"
          />
        </label>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">来源文件</span>
            <strong class="stat-value">{{ sourceFileName || "手动粘贴" }}</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">字符数</span>
            <strong class="stat-value">{{ rawCharCount }}</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">段落数</span>
            <strong class="stat-value">{{ rawParagraphCount }}</strong>
          </div>
        </div>

        <div class="actions">
          <button class="primary-btn" :disabled="generating || !rawText.trim()" @click="generateDocument">
            {{ generating ? "整理中..." : "一键整理" }}
          </button>
          <button class="secondary-btn" :disabled="!doc || exportingFormat !== null" @click="downloadFile('docx')">
            {{ exportingFormat === "docx" ? "导出 DOCX..." : "下载 DOCX" }}
          </button>
          <button class="secondary-btn" :disabled="!doc || exportingFormat !== null" @click="downloadFile('latex')">
            {{ exportingFormat === "latex" ? "导出 LaTeX..." : "下载 LaTeX" }}
          </button>
          <button class="ghost-btn" :disabled="!doc" @click="copyStructuredJson">复制 JSON</button>
        </div>

        <p v-if="exportMessage" class="message message--success message--inline">{{ exportMessage }}</p>
        <p class="hint">
          当前基础版支持粘贴原稿或拖拽文本类文件；如果你手里是 Word/PDF，先复制正文或另存为纯文本再喂。
        </p>
      </section>

      <section class="panel output-panel">
        <div class="panel-header">
          <h2>结构化结果</h2>
          <span v-if="warning" class="warning-badge">降级导入</span>
        </div>

        <div v-if="error" class="message message--error">{{ error }}</div>
        <div v-else-if="warning" class="message message--warning">{{ warning }}</div>
        <div v-else-if="doc" class="message message--success">结构化完成，可以直接下载导出。</div>
        <div v-else class="empty-state">右侧会显示整理后的结构预览和原始模型输出。</div>

        <template v-if="doc">
          <div class="metadata-card">
            <h3>{{ doc.metadata.title }}</h3>
            <p v-if="doc.metadata.subtitle">{{ doc.metadata.subtitle }}</p>
            <p v-if="doc.metadata.authors?.length">作者：{{ doc.metadata.authors.map((item) => item.name).join("、") }}</p>
            <p v-if="doc.metadata.keywords?.length">关键词：{{ doc.metadata.keywords.join("、") }}</p>
            <p class="meta-foot">{{ blockCount }} 个块 · {{ sectionCount }} 个章节</p>
          </div>

          <div class="outline-card">
            <h3>大纲预览</h3>
            <ul class="outline-list">
              <li v-for="block in doc.children" :key="block.id">{{ summarizeBlock(block) }}</li>
            </ul>
          </div>

          <div class="outline-card">
            <h3>内容预览</h3>
            <ul class="preview-list">
              <li v-for="line in previewLines" :key="line.key" :style="{ paddingLeft: `${line.depth * 18}px` }">
                {{ line.text }}
              </li>
            </ul>
          </div>

          <details class="details-card">
            <summary>查看结构化 JSON</summary>
            <pre>{{ prettyDoc }}</pre>
          </details>
        </template>

        <details v-if="modelOutput" class="details-card">
          <summary>查看模型原始输出</summary>
          <pre>{{ modelOutput }}</pre>
        </details>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { apiFetch } from "../lib/api.js";
import type { BlockNode, Doc, SectionBlock } from "@black-bean-sprouts/doc-schema";

type PreviewLine = {
  key: string;
  text: string;
  depth: number;
};

const EXAMPLE_TITLE = "示例医学原稿";
const EXAMPLE_RAW_TEXT = `慢性肾病患者营养支持路径优化研究

摘要
目的：评估分层营养支持方案对慢性肾病住院患者恢复效果的影响。
方法：回顾性纳入 2024 年 1 月至 2025 年 6 月收治的 86 例患者，比较常规饮食管理与强化营养支持两组的实验室指标、住院日和并发症发生率。
结果：强化营养支持组在白蛋白、前白蛋白及体重维持方面优于对照组，平均住院日缩短 2.3 天。
结论：针对慢性肾病患者构建标准化营养支持流程具有临床推广价值。

1 引言
慢性肾病患者常伴随代谢紊乱与蛋白能量消耗，营养管理是综合治疗的重要组成部分。

2 资料与方法
2.1 研究对象
纳入标准包括年龄 18 岁以上、住院时间超过 72 小时、具备完整实验室资料。
2.2 观察指标
主要指标包括白蛋白、前白蛋白、血红蛋白、住院日。

3 结果
强化营养支持组白蛋白中位数由 31.2 g/L 提升至 36.5 g/L。

4 讨论
标准化路径有助于减少沟通成本并提高依从性。`;

const title = ref("");
const rawText = ref("");
const sourceFileName = ref("");
const importing = ref(false);
const generating = ref(false);
const exportingFormat = ref<"docx" | "latex" | null>(null);
const dragActive = ref(false);
const error = ref("");
const warning = ref("");
const exportMessage = ref("");
const modelOutput = ref("");
const doc = ref<Doc | null>(null);

const prettyDoc = computed(() => (doc.value ? JSON.stringify(doc.value, null, 2) : ""));
const blockCount = computed(() => countBlocks(doc.value?.children ?? []));
const sectionCount = computed(() => countSections(doc.value?.children ?? []));
const rawCharCount = computed(() => rawText.value.trim().length);
const rawParagraphCount = computed(() => splitRawTextIntoParagraphs(rawText.value).length);
const canClear = computed(
  () =>
    Boolean(title.value.trim()) ||
    Boolean(rawText.value.trim()) ||
    Boolean(sourceFileName.value) ||
    Boolean(doc.value) ||
    Boolean(modelOutput.value),
);
const previewLines = computed(() => buildPreviewLines(doc.value?.children ?? []));

async function generateDocument() {
  if (!rawText.value.trim()) {
    error.value = "请先输入原稿。";
    return;
  }

  generating.value = true;
  error.value = "";
  warning.value = "";
  exportMessage.value = "";

  try {
    const response = await apiFetch<{
      doc: Doc;
      degraded: boolean;
      warning?: string;
      modelOutput?: string;
    }>("/workbench/generate", {
      method: "POST",
      body: JSON.stringify({
        title: title.value,
        rawText: rawText.value,
      }),
    });

    doc.value = response.doc;
    warning.value = response.warning ?? "";
    modelOutput.value = response.modelOutput ?? "";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "结构化请求失败。";
    doc.value = null;
    modelOutput.value = "";
  } finally {
    generating.value = false;
  }
}

async function downloadFile(format: "docx" | "latex") {
  if (!doc.value) {
    return;
  }

  error.value = "";
  exportMessage.value = "";
  exportingFormat.value = format;
  try {
    const response = await fetch("/api/workbench/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        format,
        doc: doc.value,
      }),
    });

    if (!response.ok) {
      throw new Error(`导出失败：${response.status}`);
    }

    const blob = await response.blob();
    const serverFileName = extractDownloadName(response.headers.get("Content-Disposition"));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = serverFileName ?? getDownloadName(format);
    anchor.click();
    URL.revokeObjectURL(url);
    exportMessage.value = `已导出 ${serverFileName ?? getDownloadName(format)}。`;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "导出失败。";
  } finally {
    exportingFormat.value = null;
  }
}

async function handleFilePick(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  await readFileIntoWorkbench(file);
  input.value = "";
}

function handleDragLeave(event: DragEvent) {
  if (event.currentTarget === event.target) {
    dragActive.value = false;
  }
}

async function handleDrop(event: DragEvent) {
  dragActive.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }
  await readFileIntoWorkbench(file);
}

async function readFileIntoWorkbench(file: File) {
  error.value = "";
  exportMessage.value = "";
  importing.value = true;
  if (isDocxFile(file.name)) {
    try {
      const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());
      const response = await apiFetch<{
        rawText: string;
        title?: string;
        sourceType: "docx" | "text";
      }>("/workbench/import", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentBase64,
        }),
      });
      rawText.value = response.rawText;
      if (!title.value.trim()) {
        title.value = response.title ?? file.name.replace(/\.[^.]+$/u, "");
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "DOCX 导入失败。";
      importing.value = false;
      return;
    }
  } else {
    rawText.value = await file.text();
    if (!title.value.trim()) {
      title.value = file.name.replace(/\.[^.]+$/u, "");
    }
  }

  sourceFileName.value = file.name;
  importing.value = false;
}

function loadExampleDraft() {
  title.value = EXAMPLE_TITLE;
  rawText.value = EXAMPLE_RAW_TEXT;
  sourceFileName.value = "example-medical-draft.txt";
  error.value = "";
  warning.value = "";
  exportMessage.value = "";
}

function clearWorkbench() {
  title.value = "";
  rawText.value = "";
  sourceFileName.value = "";
  error.value = "";
  warning.value = "";
  exportMessage.value = "";
  modelOutput.value = "";
  doc.value = null;
}

async function copyStructuredJson() {
  if (!doc.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(prettyDoc.value);
    exportMessage.value = "结构化 JSON 已复制到剪贴板。";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "复制 JSON 失败。";
  }
}

function getDownloadName(format: "docx" | "latex"): string {
  const base = slugify(doc.value?.metadata.title || title.value || "document");
  return format === "docx" ? `${base}.docx` : `${base}.tex`;
}

function summarizeBlock(block: BlockNode): string {
  switch (block.type) {
    case "paragraph":
      return `段落：${inlineText(block.children).slice(0, 80)}`;
    case "heading":
      return `标题 H${block.level}：${inlineText(block.children).slice(0, 80)}`;
    case "section":
      return `章节：${block.title}（${block.children.length} 个子块）`;
    case "abstract":
      return `摘要：${block.children.length} 段`;
    case "formula":
      return `公式：${block.latex.slice(0, 80)}`;
    case "table":
      return `表格：${block.rows.length} 行`;
    case "figure":
      return `图片：${block.alt || block.src}`;
    case "reference-list":
      return `参考文献：${block.items.length} 条`;
  }
}

function buildPreviewLines(blocks: readonly BlockNode[], depth = 0): PreviewLine[] {
  return blocks.flatMap((block) => {
    switch (block.type) {
      case "paragraph":
        return [{
          key: block.id,
          depth,
          text: `段落：${truncateText(inlineText(block.children), 120)}`,
        }];
      case "heading":
        return [{
          key: block.id,
          depth,
          text: `标题 H${block.level}：${truncateText(inlineText(block.children), 120)}`,
        }];
      case "section":
        return [
          {
            key: block.id,
            depth,
            text: `章节：${block.title}`,
          },
          ...buildPreviewLines(block.children, depth + 1),
        ];
      case "abstract":
        return [
          {
            key: block.id,
            depth,
            text: "摘要",
          },
          ...block.children.map((paragraph, index) => ({
            key: `${block.id}-abs-${index}`,
            depth: depth + 1,
            text: `摘要段：${truncateText(inlineText(paragraph.children), 120)}`,
          })),
        ];
      case "formula":
        return [{
          key: block.id,
          depth,
          text: `公式：${truncateText(block.latex, 120)}`,
        }];
      case "table":
        return [{
          key: block.id,
          depth,
          text: `表格：${tableColumnCount(block)} 列 / ${block.rows.length} 行`,
        }];
      case "figure":
        return [{
          key: block.id,
          depth,
          text: `图片：${block.alt || block.src}`,
        }];
      case "reference-list":
        return [
          {
            key: block.id,
            depth,
            text: `参考文献：${block.items.length} 条`,
          },
          ...block.items.map((item, index) => ({
            key: `${block.id}-ref-${index}`,
            depth: depth + 1,
            text: `${item.key} · ${item.title}`,
          })),
        ];
    }
  });
}

function inlineText(children: readonly { type: string; text?: string; latex?: string }[]): string {
  return children
    .map((item) => {
      if (item.type === "text") {
        return item.text ?? "";
      }
      if (item.type === "formula-inline") {
        return item.latex ?? "";
      }
      if (item.type === "hardBreak") {
        return " / ";
      }
      return "";
    })
    .join("")
    .trim();
}

function tableColumnCount(block: Extract<BlockNode, { type: "table" }>): number {
  return Math.max(block.headerRow?.cells.length ?? 0, ...block.rows.map((row) => row.cells.length), 0);
}

function splitRawTextIntoParagraphs(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function countBlocks(blocks: readonly BlockNode[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === "section") {
      return total + 1 + countBlocks(block.children);
    }
    return total + 1;
  }, 0);
}

function countSections(blocks: readonly BlockNode[]): number {
  return blocks.reduce((total, block) => {
    if (block.type !== "section") {
      return total;
    }
    return total + 1 + countSections((block as SectionBlock).children);
  }, 0);
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "document"
  );
}

function extractDownloadName(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) {
    return undefined;
  }
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1];
}

function isDocxFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".docx");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
</script>

<style scoped>
.workbench-page {
  min-height: 100vh;
  background: #f5f7fb;
  color: #18212f;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding: 24px 32px 18px;
  background: #ffffff;
  border-bottom: 1px solid #e6ebf2;
}

.logo {
  margin: 0;
  font-size: 28px;
}

.subtitle {
  margin: 8px 0 0;
  color: #5f6b7a;
  font-size: 14px;
}

.toolbar-nav {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-nav a {
  padding: 10px 14px;
  border-radius: 10px;
  text-decoration: none;
  color: #35507a;
  background: #eef4ff;
  font-size: 14px;
}

.toolbar-nav a.router-link-active {
  background: #1f5eff;
  color: #fff;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 24px;
  padding: 24px 32px 32px;
}

.panel {
  background: #fff;
  border: 1px solid #e6ebf2;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 12px 40px rgba(31, 57, 102, 0.06);
}

.panel--dragging {
  border-color: #1f5eff;
  box-shadow: 0 0 0 3px rgba(31, 94, 255, 0.12);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.panel-header h2,
.outline-card h3,
.metadata-card h3 {
  margin: 0;
}

.input-panel {
  display: flex;
  flex-direction: column;
  min-height: 720px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.field span {
  font-size: 13px;
  color: #4a5665;
  font-weight: 600;
}

.field--grow {
  flex: 1;
}

.text-input,
.text-area {
  border: 1px solid #d5deea;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.15s ease;
}

.text-input:focus,
.text-area:focus {
  border-color: #1f5eff;
}

.text-area {
  min-height: 420px;
  resize: vertical;
  flex: 1;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.primary-btn,
.secondary-btn,
.upload-btn,
.ghost-btn {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.primary-btn {
  background: #1f5eff;
  color: #fff;
}

.secondary-btn,
.upload-btn,
.ghost-btn {
  background: #edf2fb;
  color: #244061;
}

.primary-btn:disabled,
.secondary-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.upload-btn {
  position: relative;
  overflow: hidden;
}

.upload-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  border: 1px solid #e6ebf2;
  border-radius: 12px;
  background: #f8fbff;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: #607086;
}

.stat-value {
  font-size: 14px;
  color: #18212f;
  word-break: break-word;
}

.hint {
  margin: 14px 0 0;
  font-size: 13px;
  color: #627286;
}

.output-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state,
.message {
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 14px;
}

.empty-state {
  background: #f6f8fb;
  color: #637385;
}

.message--error {
  background: #fff1f2;
  color: #b42318;
}

.message--warning {
  background: #fff7ed;
  color: #c2410c;
}

.message--success {
  background: #ecfdf3;
  color: #027a48;
}

.message--inline {
  margin: 12px 0 0;
}

.warning-badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #fff2e2;
  color: #c25b00;
  font-size: 12px;
  font-weight: 700;
}

.metadata-card,
.outline-card,
.details-card {
  border: 1px solid #e6ebf2;
  border-radius: 14px;
  padding: 16px;
  background: #fafcff;
}

.metadata-card p,
.meta-foot {
  margin: 8px 0 0;
  color: #5f6b7a;
  font-size: 14px;
}

.outline-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #344256;
}

.outline-list li + li,
.preview-list li + li {
  margin-top: 8px;
}

.preview-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  color: #344256;
}

.details-card summary {
  cursor: pointer;
  font-weight: 700;
}

.details-card pre {
  margin: 14px 0 0;
  max-height: 320px;
  overflow: auto;
  background: #101828;
  color: #d0d5dd;
  border-radius: 12px;
  padding: 14px;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1080px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
