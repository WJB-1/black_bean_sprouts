<template>
  <div class="workbench-page">
    <!-- 顶部导航 -->
    <header class="toolbar">
      <div class="toolbar-brand">
        <div class="logo-icon">🌱</div>
        <div>
          <h1 class="logo">黑豆芽</h1>
          <p class="subtitle">AI 文档结构化工作台</p>
        </div>
      </div>
      <nav class="toolbar-nav">
        <router-link to="/workbench" class="nav-link nav-link--active">工作台</router-link>
        <router-link to="/editor/new" class="nav-link">编辑器</router-link>
        <router-link to="/admin" class="nav-link">后台</router-link>
      </nav>
    </header>

    <main class="layout">
      <!-- 左侧：输入区 -->
      <section
        class="panel input-panel"
        :class="{ 'panel--dragging': dragActive }"
        @dragenter.prevent="dragActive = true"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <!-- 模板选择 -->
        <div class="template-section">
          <div class="section-header">
            <h2 class="section-title">📄 选择排版模板</h2>
            <p class="section-desc">选择适合您文档的模板，AI 将按此规范进行结构化</p>
          </div>
          <div class="template-grid">
            <button
              v-for="profile in styleProfiles"
              :key="profile.id"
              type="button"
              class="template-card"
              :class="{ 'template-card--active': exportStyle.styleProfileId === profile.id }"
              @click="selectTemplate(profile)"
            >
              <div class="template-name">{{ profile.name }}</div>
              <div class="template-desc">{{ profile.description }}</div>
              <div v-if="exportStyle.styleProfileId === profile.id" class="template-check">✓</div>
            </button>
          </div>
        </div>

        <!-- 快捷指令胶囊 -->
        <div class="chips-section">
          <div class="section-header">
            <h2 class="section-title">⚡ 快捷指令</h2>
          </div>
          <div class="chips-row">
            <button
              v-for="chip in actionChips"
              :key="chip.id"
              type="button"
              class="chip"
              :disabled="!rawText.trim() || generating"
              @click="runChipAction(chip)"
            >
              <span class="chip-icon">{{ chip.icon }}</span>
              <span>{{ chip.label }}</span>
            </button>
          </div>
        </div>

        <!-- 拖拽上传区 -->
        <div
          class="upload-zone"
          :class="{ 'upload-zone--active': dragActive, 'upload-zone--has-file': sourceFileName }"
        >
          <div class="upload-content">
            <div class="upload-icon">{{ dragActive ? '📥' : sourceFileName ? '📄' : '📎' }}</div>
            <div v-if="sourceFileName" class="upload-file-name">{{ sourceFileName }}</div>
            <div v-else class="upload-text">
              <strong>拖拽文件到此处</strong>，或
              <label class="upload-link">
                <input
                  type="file"
                  accept=".txt,.text,.md,.markdown,.tex,.csv,.json,.yaml,.yml,.html,.docx"
                  @change="handleFilePick"
                />
                点击选择文件
              </label>
            </div>
            <div class="upload-hint">支持 .docx、.txt、.md 等格式 · 最大 25MB</div>
          </div>
        </div>

        <!-- 恢复提示 -->
        <Transition name="fade">
          <div v-if="draftRecoveryMessage" class="recovery-banner">
            <span class="recovery-icon">💾</span>
            <span>{{ draftRecoveryMessage }}</span>
            <button class="recovery-dismiss" type="button" @click="draftRecoveryMessage = ''">×</button>
          </div>
        </Transition>

        <!-- 标题输入 -->
        <div class="field">
          <label class="field-label">文档标题</label>
          <input
            v-model="title"
            class="input text-input"
            placeholder="输入文档标题，或留空让 AI 自动提取"
          />
        </div>

        <!-- 正文输入 -->
        <div class="field field--grow">
          <div class="field-header">
            <label class="field-label">未整理原稿</label>
            <div class="field-stats">
              <span class="stat-badge">{{ rawCharCount.toLocaleString() }} 字</span>
              <span class="stat-badge">{{ rawParagraphCount }} 段</span>
            </div>
          </div>
          <textarea
            v-model="rawText"
            class="input input--textarea"
            :class="{ 'input--dragging': dragActive }"
            placeholder="直接粘贴原稿内容，或从上方导入文件..."
            :disabled="importing"
          />
        </div>

        <!-- 排版参数 -->
        <details class="style-details">
          <summary class="style-summary">
            <span>🎨 排版参数</span>
            <span class="style-summary-hint">{{ selectedStyleDescription }}</span>
          </summary>
          <div class="style-grid">
            <div class="field field--compact">
              <label class="field-label">正文字号 (pt)</label>
              <input
                v-model.number="exportStyle.bodyFontSizePt"
                class="input"
                type="number"
                min="8"
                max="24"
                step="0.5"
              />
            </div>
            <div class="field field--compact">
              <label class="field-label">行距</label>
              <input
                v-model.number="exportStyle.lineSpacing"
                class="input"
                type="number"
                min="1"
                max="3"
                step="0.05"
              />
            </div>
            <div class="field field--compact">
              <label class="field-label">上边距 (mm)</label>
              <input
                v-model.number="exportStyle.marginTopMm"
                class="input"
                type="number"
                min="5"
                max="60"
              />
            </div>
            <div class="field field--compact">
              <label class="field-label">下边距 (mm)</label>
              <input
                v-model.number="exportStyle.marginBottomMm"
                class="input"
                type="number"
                min="5"
                max="60"
              />
            </div>
            <div class="field field--compact">
              <label class="field-label">左边距 (mm)</label>
              <input
                v-model.number="exportStyle.marginLeftMm"
                class="input"
                type="number"
                min="5"
                max="60"
              />
            </div>
            <div class="field field--compact">
              <label class="field-label">右边距 (mm)</label>
              <input
                v-model.number="exportStyle.marginRightMm"
                class="input"
                type="number"
                min="5"
                max="60"
              />
            </div>
          </div>
          <div class="style-actions">
            <button type="button" class="btn btn--ghost btn--sm" @click="resetStyleSettings">恢复默认</button>
          </div>
        </details>

        <!-- 操作按钮区 -->
        <div class="action-bar">
          <button
            class="btn btn--primary btn--lg"
            :disabled="generating || !rawText.trim()"
            @click="generateDocument"
          >
            <span v-if="generating" class="btn-spinner">⏳</span>
            <span>{{ generating ? generateStepText : '✨ 一键整理' }}</span>
          </button>

          <div class="action-secondary">
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              :disabled="!rawText.trim() || directDocxExporting"
              @click="downloadDirectDocx"
            >
              {{ directDocxExporting ? '生成中...' : '📄 直接 Word' }}
            </button>
            <button type="button" class="btn btn--ghost btn--sm" @click="loadExampleDraft">📋 载入示例</button>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              :disabled="!canClear"
              @click="confirmClear"
            >
              🗑️ 清空
            </button>
          </div>
        </div>

        <!-- 生成进度条 -->
        <Transition name="slide-down">
          <div v-if="generating" class="progress-bar">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: generateProgress + '%' }"></div>
            </div>
            <div class="progress-message">{{ generateStepText }}</div>
            <div class="progress-steps">
              <span
                v-for="(step, i) in generateSteps"
                :key="i"
                class="progress-step"
                :class="{ 'progress-step--done': i < generateStepIndex, 'progress-step--active': i === generateStepIndex }"
              >
                {{ step }}
              </span>
            </div>
          </div>
        </Transition>
      </section>

      <!-- 右侧：输出区 -->
      <section class="panel output-panel">
        <div class="panel-header">
          <h2 class="section-title">📋 结构化结果</h2>
          <div class="panel-badges">
            <span v-if="warning" class="badge badge--warning">已回退导入</span>
            <span v-if="doc" class="badge badge--success">{{ blockCount }} 块 · {{ sectionCount }} 章节</span>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!doc && !error && !warning" class="empty-state">
          <div class="empty-illustration">📄➡️✨</div>
          <p>在左侧输入原稿并点击"一键整理"</p>
          <p class="empty-hint">AI 将自动分析文档结构，提取标题、摘要、章节、参考文献等</p>
        </div>

        <!-- 错误/警告 -->
        <Transition name="fade">
          <div v-if="error" class="message message--error">
            <span class="message-icon">⚠️</span>
            <span>{{ error }}</span>
            <button class="message-close" type="button" @click="error = ''">×</button>
          </div>
        </Transition>

        <Transition name="fade">
          <div v-if="warning" class="message message--warning">
            <span class="message-icon">⚡</span>
            <span>{{ warning }}</span>
          </div>
        </Transition>

        <!-- 成功提示 -->
        <Transition name="fade">
          <div v-if="exportMessage" class="message message--success">
            <span class="message-icon">✓</span>
            <span>{{ exportMessage }}</span>
            <button class="message-close" type="button" @click="exportMessage = ''">×</button>
          </div>
        </Transition>

        <!-- 文档元信息卡片 -->
        <Transition name="fade-up">
          <div v-if="doc" class="doc-card">
            <div class="doc-header">
              <h3 class="doc-title">{{ doc.metadata.title || '未命名文档' }}</h3>
              <div v-if="doc.metadata.subtitle" class="doc-subtitle">{{ doc.metadata.subtitle }}</div>
            </div>
            <div v-if="doc.metadata.authors?.length" class="doc-meta-row">
              <span class="doc-meta-label">作者</span>
              <span>{{ doc.metadata.authors.map(a => a.name).join('、') }}</span>
            </div>
            <div v-if="doc.metadata.keywords?.length" class="doc-meta-row">
              <span class="doc-meta-label">关键词</span>
              <div class="keyword-list">
                <span v-for="kw in doc.metadata.keywords" :key="kw" class="keyword-tag">{{ kw }}</span>
              </div>
            </div>
            <div v-if="doc.metadata.institution" class="doc-meta-row">
              <span class="doc-meta-label">机构</span>
              <span>{{ doc.metadata.institution }}</span>
            </div>
          </div>
        </Transition>

        <!-- 大纲树 -->
        <Transition name="fade-up">
          <div v-if="doc" class="outline-card">
            <div class="card-header">
              <h4>🗂️ 文档大纲</h4>
              <button type="button" class="btn btn--ghost btn--sm" @click="expandAll = !expandAll">
                {{ expandAll ? '收起' : '展开' }}
              </button>
            </div>
            <div class="outline-tree">
              <OutlineNode
                v-for="block in doc.children"
                :key="block.id"
                :block="block"
                :expand-all="expandAll"
              />
            </div>
          </div>
        </Transition>

        <!-- 排版预览 -->
        <Transition name="fade-up">
          <div v-if="doc" class="preview-card">
            <div class="card-header">
              <h4>👁️ 排版预览</h4>
              <span class="preview-hint">模拟 {{ exportStyle.bodyFontSizePt }}pt / {{ exportStyle.lineSpacing }}倍行距</span>
            </div>
            <div class="preview-document">
              <div class="preview-page">
                <PreviewBlock
                  v-for="block in doc.children"
                  :key="block.id"
                  :block="block"
                  :style-config="exportStyle"
                />
              </div>
            </div>
          </div>
        </Transition>

        <!-- 导出操作 -->
        <Transition name="fade-up">
          <div v-if="doc" class="export-card">
            <div class="card-header">
              <h4>📥 导出文档</h4>
            </div>
            <div class="export-actions">
              <button
                class="btn btn--secondary"
                :disabled="exportingFormat !== null"
                @click="downloadFile('docx')"
              >
                <span>{{ exportingFormat === 'docx' ? '导出中...' : '📄 DOCX' }}</span>
              </button>
              <button
                class="btn btn--secondary"
                :disabled="exportingFormat !== null"
                @click="downloadFile('latex')"
              >
                <span>{{ exportingFormat === 'latex' ? '导出中...' : '📝 LaTeX' }}</span>
              </button>
              <button class="btn btn--ghost" @click="copyStructuredJson">📋 复制 JSON</button>
            </div>
            <label class="download-setting">
              <input v-model="downloadWithPicker" type="checkbox" @change="persistDownloadPreference" />
              <span>导出时手动选择保存位置</span>
            </label>
          </div>
        </Transition>

        <!-- 保存到编辑器 -->
        <Transition name="fade-up">
          <div v-if="doc" class="save-card">
            <button
              class="btn btn--primary"
              :disabled="savingToEditor"
              @click="openInEditor"
            >
              <span>{{ savingToEditor ? '保存中...' : '💾 保存并进入编辑器' }}</span>
            </button>
          </div>
        </Transition>

        <!-- 调试信息 -->
        <details v-if="modelOutput" class="debug-card">
          <summary>🔧 调试：模型原始输出</summary>
          <pre class="debug-pre">{{ modelOutput }}</pre>
        </details>

        <details v-if="doc" class="debug-card">
          <summary>🔧 调试：结构化 JSON</summary>
          <pre class="debug-pre">{{ prettyDoc }}</pre>
        </details>

        <!-- 最近文档 -->
        <div class="recent-card">
          <div class="card-header">
            <h4>🕐 最近文档</h4>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              :disabled="recentDocumentsLoading"
              @click="loadRecentDocuments"
            >
              {{ recentDocumentsLoading ? '刷新中...' : '刷新' }}
            </button>
          </div>

          <div class="recover-inline">
            <input
              v-model="recoverDocumentId"
              class="input"
              placeholder="输入文档 ID 找回"
              @keydown.enter.prevent="openRecoverDocument()"
            />
            <button type="button" class="btn btn--secondary btn--sm" @click="openRecoverDocument()">打开</button>
          </div>

          <div v-if="recentDocumentsError" class="message message--warning">{{ recentDocumentsError }}</div>

          <div v-else-if="recentDocuments.length === 0" class="empty-state empty-state--compact">
            暂无最近文档
          </div>

          <ul v-else class="recent-list">
            <li v-for="item in recentDocuments" :key="item.id" class="recent-item">
              <div class="recent-info">
                <div class="recent-title">{{ item.title || 'Untitled' }}</div>
                <div class="recent-meta">版本 {{ item.version }} · {{ formatRecentDocumentTime(item.updatedAt) }}</div>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" @click="openRecentDocument(item.id)">打开</button>
            </li>
          </ul>
        </div>
      </section>
    </main>

    <!-- 确认对话框 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showConfirmDialog" class="modal-overlay" @click="showConfirmDialog = false">
          <div class="modal-card" @click.stop
          >
            <h3>{{ confirmDialog.title }}</h3>
            <p>{{ confirmDialog.message }}</p>
            <div class="modal-actions"
            >
              <button type="button" class="btn btn--ghost" @click="showConfirmDialog = false">取消</button>
              <button type="button" class="btn btn--danger" @click="confirmDialog.onConfirm">确认</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../lib/api.js";
import type { BlockNode, Doc, SectionBlock } from "@black-bean-sprouts/doc-schema";
import OutlineNode from "../components/workbench/OutlineNode.vue";
import PreviewBlock from "../components/workbench/PreviewBlock.vue";
import { useToast } from "../composables/useToast.js";

const toast = useToast();

/* ---------- 类型 ---------- */
type PreviewLine = { key: string; text: string; depth: number };

type SaveFilePickerHandle = {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
};

type PickerWindow = Window & typeof globalThis & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<SaveFilePickerHandle>;
};

type WorkbenchStyleProfile = {
  id: string;
  name: string;
  description: string;
  defaults: {
    bodyFontSizePt: number;
    lineSpacing: number;
    marginTopMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
    marginRightMm: number;
  };
};

type ExportStyleSettings = {
  styleProfileId: string;
  bodyFontSizePt: number;
  lineSpacing: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
};

type StoredWorkbenchDraft = {
  title?: string;
  rawText?: string;
  sourceFileName?: string;
  warning?: string;
  modelOutput?: string;
  doc?: Doc | null;
  savedAt?: string;
};

type RecentDocumentSummary = {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
  createdAt: string;
};

type GenerateJobResponse = {
  id: string;
  status: "running" | "completed" | "failed" | "cancelled";
  progress?: {
    stage?: string;
    message?: string;
    progress?: number;
  };
  result?: {
    doc?: unknown;
    degraded?: boolean;
    warning?: string;
    modelOutput?: string;
  };
  error?: string;
};

type ActionChip = { id: string; icon: string; label: string; prompt: string };

type ConfirmDialog = { title: string; message: string; onConfirm: () => void };

/* ---------- 常量 ---------- */
const EXAMPLE_TITLE = "示例医学原稿";
const EXAMPLE_RAW_TEXT = `慢性肾病患者营养支持路径优化研究

摘要
目的：评估分层营养支持方案对慢性肾病住院患者恢复效果的影响。方法：回顾性纳入 2024 年 1 月至 2025 年 6 月收治的 86 例患者，比较常规饮食管理与强化营养支持两组的实验室指标、住院日和并发症发生率。结果：强化营养支持组在白蛋白、前白蛋白及体重维持方面优于对照组，平均住院日缩短 2.3 天。结论：针对慢性肾病患者构建标准化营养支持流程具有临床推广价值。

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

const DEFAULT_STYLE: ExportStyleSettings = {
  styleProfileId: "default",
  bodyFontSizePt: 12,
  lineSpacing: 1.5,
  marginTopMm: 25,
  marginBottomMm: 25,
  marginLeftMm: 30,
  marginRightMm: 25,
};

const actionChips: ActionChip[] = [
  { id: "format", icon: "✨", label: "一键全文排版", prompt: "请对全文进行规范化排版，调整段落间距、标题层级和字体格式。" },
  { id: "figures", icon: "📊", label: "提取并美化图表", prompt: "请识别文中的表格和图表，优化其格式和排版。" },
  { id: "refs", icon: "📑", label: "规范化参考文献", prompt: "请检查并规范化参考文献格式，确保引用标注正确。" },
  { id: "abstract", icon: "📝", label: "检查摘要结构", prompt: "请检查摘要是否包含目的、方法、结果、结论四要素，并给出优化建议。" },
];

const generateSteps = ["分析文档结构", "提取元数据", "识别章节层级", "生成结构化结果"];
const generateStageIndex: Record<string, number> = {
  start: 0,
  prompt: 0,
  model: 1,
  parse: 2,
  validate: 3,
  fallback: 3,
  done: 3,
};

/* ---------- 状态 ---------- */
const title = ref("");
const rawText = ref("");
const sourceFileName = ref("");
const importing = ref(false);
const generating = ref(false);
const generateStepIndex = ref(0);
const generateStepText = ref("分析文档结构...");
const generateProgress = ref(0);

const exportingFormat = ref<"docx" | "latex" | null>(null);
const directDocxExporting = ref(false);
const savingToEditor = ref(false);
const dragActive = ref(false);
const error = ref("");
const warning = ref("");
const exportMessage = ref("");
const modelOutput = ref("");
const doc = ref<Doc | null>(null);
const styleProfiles = ref<WorkbenchStyleProfile[]>([]);
const expandAll = ref(true);

const DOWNLOAD_WITH_PICKER_KEY = "bbs.workbench.downloadWithPicker";
const EXPORT_STYLE_KEY = "bbs.workbench.exportStyle";
const WORKBENCH_DRAFT_KEY = "bbs.workbench.draft.v1";
const downloadWithPicker = ref(loadStoredBoolean(DOWNLOAD_WITH_PICKER_KEY, false));
const exportStyle = ref<ExportStyleSettings>(loadStoredStyleSettings());
const draftRecoveryMessage = ref("");
const recentDocuments = ref<RecentDocumentSummary[]>([]);
const recentDocumentsLoading = ref(false);
const recentDocumentsError = ref("");
const recoverDocumentId = ref("");

const showConfirmDialog = ref(false);
const confirmDialog = ref<ConfirmDialog>({ title: "", message: "", onConfirm: () => {} });

const router = useRouter();

/* ---------- 计算属性 ---------- */
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
const selectedStyleDescription = computed(() => {
  const selected = styleProfiles.value.find((item) => item.id === exportStyle.value.styleProfileId);
  return selected?.description ?? "当前使用自定义导出参数。";
});

/* ---------- 监听 ---------- */
watch(
  exportStyle,
  () => {
    persistStyleSettings();
  },
  { deep: true },
);

watch(
  [title, rawText, sourceFileName, warning, modelOutput, doc],
  () => {
    persistWorkbenchDraft();
  },
  { deep: true },
);

/* ---------- 生命周期 ---------- */
onMounted(() => {
  restoreWorkbenchDraft();
  void loadStyleProfiles();
  void loadRecentDocuments();
});

/* ---------- 模板选择 ---------- */
function selectTemplate(profile: WorkbenchStyleProfile) {
  exportStyle.value = {
    styleProfileId: profile.id,
    bodyFontSizePt: profile.defaults.bodyFontSizePt,
    lineSpacing: profile.defaults.lineSpacing,
    marginTopMm: profile.defaults.marginTopMm,
    marginBottomMm: profile.defaults.marginBottomMm,
    marginLeftMm: profile.defaults.marginLeftMm,
    marginRightMm: profile.defaults.marginRightMm,
  };
}

/* ---------- 快捷指令 ---------- */
function runChipAction(chip: ActionChip) {
  if (!rawText.value.trim()) {
    toast.warning("请先输入原稿内容");
    return;
  }
  // 将 chip 的 prompt 追加到 rawText 中，模拟 AI 处理
  rawText.value += `\n\n[${chip.label}]\n${chip.prompt}`;
  toast.info(`已添加「${chip.label}」指令`);
}

/* ---------- 生成进度 ---------- */
function startGenerateProgress() {
  generateStepIndex.value = 0;
  generateProgress.value = 5;
  generateStepText.value = generateSteps[0] + "...";
}

function applyGenerateProgress(progress: { stage?: string; message?: string; progress?: number }) {
  const stage = progress.stage ?? "";
  generateStepIndex.value = generateStageIndex[stage] ?? generateStepIndex.value;
  generateProgress.value = clampProgress(progress.progress ?? generateProgress.value);
  generateStepText.value = progress.message?.trim() || `${generateSteps[generateStepIndex.value]}...`;
}

function stopGenerateProgress() {
  generateProgress.value = 100;
  generateStepText.value = "完成";
  setTimeout(() => {
    generateProgress.value = 0;
    generateStepIndex.value = 0;
  }, 500);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return generateProgress.value;
  return Math.max(0, Math.min(100, value));
}

function parseNdjsonRecord(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readGenerateDoneRecord(record: Record<string, unknown>): {
  doc: Doc;
  degraded: boolean;
  warning?: string;
  modelOutput?: string;
} {
  if (!isRecord(record.doc)) {
    throw new Error("后端返回的文档结构无效。");
  }
  return {
    doc: record.doc as Doc,
    degraded: record.degraded === true,
    warning: typeof record.warning === "string" ? record.warning : undefined,
    modelOutput: typeof record.modelOutput === "string" ? record.modelOutput : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------- API 调用 ---------- */
async function loadStyleProfiles() {
  try {
    const profiles = await apiFetch<WorkbenchStyleProfile[]>("/workbench/style-profiles", { method: "GET" });
    styleProfiles.value = profiles;
    if (!profiles.some((item) => item.id === exportStyle.value.styleProfileId)) {
      const fallback = profiles[0];
      if (fallback) {
        exportStyle.value = {
          styleProfileId: fallback.id,
          bodyFontSizePt: fallback.defaults.bodyFontSizePt,
          lineSpacing: fallback.defaults.lineSpacing,
          marginTopMm: fallback.defaults.marginTopMm,
          marginBottomMm: fallback.defaults.marginBottomMm,
          marginLeftMm: fallback.defaults.marginLeftMm,
          marginRightMm: fallback.defaults.marginRightMm,
        };
      }
    }
  } catch {
    styleProfiles.value = [{
      id: "default",
      name: "默认学术版",
      description: "默认学术版式。",
      defaults: { ...DEFAULT_STYLE },
    }];
  }
}

async function loadRecentDocuments() {
  recentDocumentsLoading.value = true;
  recentDocumentsError.value = "";
  try {
    recentDocuments.value = await apiFetch<RecentDocumentSummary[]>("/documents?limit=12", { method: "GET" });
  } catch (cause) {
    recentDocuments.value = [];
    recentDocumentsError.value = cause instanceof Error ? cause.message : "加载最近文档失败。";
  } finally {
    recentDocumentsLoading.value = false;
  }
}

async function generateDocument() {
  if (!rawText.value.trim()) {
    error.value = "请先输入原稿。";
    return;
  }

  generating.value = true;
  error.value = "";
  warning.value = "";
  exportMessage.value = "";
  startGenerateProgress();

  try {
    const response = await pollGenerateDocument();
    doc.value = response.doc;
    warning.value = response.warning ?? "";
    modelOutput.value = response.modelOutput ?? "";
    toast.success("文档结构化完成！");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "结构化请求失败。";
    doc.value = null;
    modelOutput.value = "";
    toast.error(error.value);
  } finally {
    stopGenerateProgress();
    generating.value = false;
  }
}

async function pollGenerateDocument(): Promise<{
  doc: Doc;
  degraded: boolean;
  warning?: string;
  modelOutput?: string;
}> {
  let job = await createGenerateJob();
  applyGenerateProgress(job.progress ?? {});

  while (job.status === "running") {
    await delay(1000);
    job = await fetchGenerateJob(job.id);
    applyGenerateProgress(job.progress ?? {});
  }

  if (job.status === "completed") {
    return readGenerateJobResult(job);
  }
  if (job.status === "cancelled") {
    throw new Error("生成任务已取消。");
  }
  throw new Error(job.error || "生成任务失败。");
}

async function createGenerateJob(): Promise<GenerateJobResponse> {
  const response = await fetch("/api/workbench/generate/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.value, rawText: rawText.value }),
  });
  return readGenerateJobResponse(response, "创建生成任务失败");
}

async function fetchGenerateJob(jobId: string): Promise<GenerateJobResponse> {
  const response = await fetch(`/api/workbench/generate/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });
  return readGenerateJobResponse(response, "查询生成进度失败");
}

async function readGenerateJobResponse(response: Response, fallbackMessage: string): Promise<GenerateJobResponse> {
  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(failureText.trim() || `${fallbackMessage}：${response.status}`);
  }
  const data = (await response.json()) as unknown;
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.status !== "string") {
    throw new Error("后端返回的生成任务状态无效。");
  }
  return data as GenerateJobResponse;
}

function readGenerateJobResult(job: GenerateJobResponse): {
  doc: Doc;
  degraded: boolean;
  warning?: string;
  modelOutput?: string;
} {
  if (!isRecord(job.result) || !isRecord(job.result.doc)) {
    throw new Error("后端没有返回结构化结果。");
  }
  return {
    doc: job.result.doc as Doc,
    degraded: job.result.degraded === true,
    warning: typeof job.result.warning === "string" ? job.result.warning : undefined,
    modelOutput: typeof job.result.modelOutput === "string" ? job.result.modelOutput : undefined,
  };
}

async function streamGenerateDocument(): Promise<{
  doc: Doc;
  degraded: boolean;
  warning?: string;
  modelOutput?: string;
}> {
  const response = await fetch("/api/workbench/generate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.value, rawText: rawText.value }),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(failureText.trim() || `结构化请求失败：${response.status}`);
  }
  if (!response.body) {
    throw new Error("浏览器不支持流式读取生成进度。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: {
    doc: Doc;
    degraded: boolean;
    warning?: string;
    modelOutput?: string;
  } | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const record = parseNdjsonRecord(line);
        if (!record) continue;
        if (record.type === "progress" && isRecord(record.progress)) {
          applyGenerateProgress(record.progress as { stage?: string; message?: string; progress?: number });
        } else if (record.type === "done") {
          finalResult = readGenerateDoneRecord(record);
        } else if (record.type === "error") {
          throw new Error(typeof record.error === "string" ? record.error : "结构化请求失败。");
        }
      }
    }
    if (done) break;
  }

  const trailingRecord = parseNdjsonRecord(buffer);
  if (trailingRecord?.type === "done") {
    finalResult = readGenerateDoneRecord(trailingRecord);
  }
  if (!finalResult) {
    throw new Error("后端没有返回结构化结果。");
  }
  return finalResult;
}

async function downloadFile(format: "docx" | "latex") {
  if (!doc.value) return;

  error.value = "";
  exportMessage.value = "";
  exportingFormat.value = format;

  try {
    const response = await fetch("/api/workbench/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, doc: doc.value, style: buildExportStylePayload() }),
    });

    if (!response.ok) {
      const failureText = await response.text();
      throw new Error(failureText.trim() || `导出失败：${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: response.headers.get("Content-Type") ?? getMimeType(format) });
    const serverFileName = extractDownloadName(response.headers.get("Content-Disposition"));
    const fileName = serverFileName ?? getDownloadName(format);
    const savedWithPicker = await saveExportBlob(blob, fileName, format);
    exportMessage.value = savedWithPicker ? `已保存：${fileName}` : `已下载：${fileName}`;
    toast.success(exportMessage.value);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "导出失败。";
    toast.error(error.value);
  } finally {
    exportingFormat.value = null;
  }
}

async function downloadDirectDocx() {
  if (!rawText.value.trim()) {
    error.value = "请先输入原稿。";
    return;
  }

  error.value = "";
  warning.value = "";
  exportMessage.value = "";
  directDocxExporting.value = true;

  try {
    const response = await fetch("/api/workbench/generate-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.value,
        rawText: rawText.value,
        style: buildExportStylePayload(),
      }),
    });

    if (!response.ok) {
      const failureText = await response.text();
      throw new Error(failureText.trim() || `Word 生成失败：${response.status}`);
    }

    const warningHeader = response.headers.get("X-BBS-Generation-Warning");
    if (warningHeader) {
      warning.value = decodeURIComponent(warningHeader);
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], {
      type: response.headers.get("Content-Type") ?? getMimeType("docx"),
    });
    const serverFileName = extractDownloadName(response.headers.get("Content-Disposition"));
    const fileName = serverFileName ?? getDirectDocxDownloadName();
    const savedWithPicker = await saveExportBlob(blob, fileName, "docx");
    exportMessage.value = savedWithPicker ? `已保存：${fileName}` : `已下载：${fileName}`;
    toast.success(exportMessage.value);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Word 生成失败。";
    toast.error(error.value);
  } finally {
    directDocxExporting.value = false;
  }
}

async function openInEditor() {
  if (!doc.value || savingToEditor.value) return;

  error.value = "";
  exportMessage.value = "";
  savingToEditor.value = true;

  try {
    const response = await apiFetch<{ id: string; version: number; content: Doc }>("/documents", {
      method: "POST",
      body: JSON.stringify({
        title: doc.value.metadata.title || title.value,
        content: doc.value,
      }),
    });

    exportMessage.value = `已保存为文档 ${response.id}`;
    recoverDocumentId.value = response.id;
    void loadRecentDocuments();
    toast.success("文档已保存");
    await router.push(`/editor/${response.id}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "保存文档失败。";
    toast.error(error.value);
  } finally {
    savingToEditor.value = false;
  }
}

async function openRecentDocument(id: string) {
  recoverDocumentId.value = id;
  await openRecoverDocument(id);
}

async function openRecoverDocument(inputId?: string) {
  const documentId = (inputId ?? recoverDocumentId.value).trim();
  if (!documentId) {
    recentDocumentsError.value = "请先输入文档 ID。";
    return;
  }

  recentDocumentsError.value = "";
  try {
    await apiFetch<{ id: string; version: number; content: Doc }>(`/documents/${encodeURIComponent(documentId)}`, { method: "GET" });
    await router.push(`/editor/${documentId}`);
  } catch (cause) {
    recentDocumentsError.value = cause instanceof Error ? cause.message : "打开文档失败。";
    toast.error(recentDocumentsError.value);
  }
}

/* ---------- 工具函数 ---------- */
function buildExportStylePayload() {
  return { ...exportStyle.value };
}

function resetStyleSettings() {
  exportStyle.value = { ...DEFAULT_STYLE };
}

function applySelectedProfileDefaults() {
  const selected = styleProfiles.value.find((item) => item.id === exportStyle.value.styleProfileId);
  if (!selected) return;
  exportStyle.value = {
    styleProfileId: selected.id,
    bodyFontSizePt: selected.defaults.bodyFontSizePt,
    lineSpacing: selected.defaults.lineSpacing,
    marginTopMm: selected.defaults.marginTopMm,
    marginBottomMm: selected.defaults.marginBottomMm,
    marginLeftMm: selected.defaults.marginLeftMm,
    marginRightMm: selected.defaults.marginRightMm,
  };
}

function persistDownloadPreference() {
  try {
    window.localStorage.setItem(DOWNLOAD_WITH_PICKER_KEY, downloadWithPicker.value ? "1" : "0");
  } catch { /* ignore */ }
}

function persistStyleSettings() {
  try {
    window.localStorage.setItem(EXPORT_STYLE_KEY, JSON.stringify(exportStyle.value));
  } catch { /* ignore */ }
}

function persistWorkbenchDraft() {
  try {
    const draft: StoredWorkbenchDraft = {
      title: title.value,
      rawText: rawText.value,
      sourceFileName: sourceFileName.value,
      warning: warning.value,
      modelOutput: modelOutput.value,
      doc: doc.value,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* ignore */ }
}

function restoreWorkbenchDraft() {
  try {
    const raw = window.localStorage.getItem(WORKBENCH_DRAFT_KEY);
    if (!raw) return;

    const draft = JSON.parse(raw) as StoredWorkbenchDraft;
    title.value = typeof draft.title === "string" ? draft.title : "";
    rawText.value = typeof draft.rawText === "string" ? draft.rawText : "";
    sourceFileName.value = typeof draft.sourceFileName === "string" ? draft.sourceFileName : "";
    warning.value = typeof draft.warning === "string" ? draft.warning : "";
    modelOutput.value = typeof draft.modelOutput === "string" ? draft.modelOutput : "";
    doc.value = isStoredDoc(draft.doc) ? draft.doc : null;

    const restoredParts = [
      rawText.value.trim() ? "原稿" : "",
      doc.value ? "结构化结果" : "",
    ].filter(Boolean);
    if (restoredParts.length > 0) {
      const savedAt = formatDraftTime(draft.savedAt);
      draftRecoveryMessage.value = savedAt
        ? `已自动恢复上次草稿：${restoredParts.join(" / ")}（${savedAt}）`
        : `已自动恢复上次草稿：${restoredParts.join(" / ")}`;
    }
  } catch { /* ignore */ }
}

function clearStoredWorkbenchDraft() {
  try {
    window.localStorage.removeItem(WORKBENCH_DRAFT_KEY);
  } catch { /* ignore */ }
}

function confirmClear() {
  confirmDialog.value = {
    title: "确认清空",
    message: "这将清除所有输入内容和生成结果，且无法撤销。是否继续？",
    onConfirm: () => {
      clearWorkbench();
      showConfirmDialog.value = false;
    },
  };
  showConfirmDialog.value = true;
}

/* ---------- 文件处理 ---------- */
async function handleFilePick(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
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
  if (!file) return;
  await readFileIntoWorkbench(file);
}

async function readFileIntoWorkbench(file: File) {
  error.value = "";
  exportMessage.value = "";
  importing.value = true;

  try {
    if (isDocxFile(file.name)) {
      const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());
      const response = await apiFetch<{ rawText: string; title?: string; sourceType: "docx" | "text" }>("/workbench/import", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, contentBase64 }),
      });
      rawText.value = response.rawText;
      if (!title.value.trim()) {
        title.value = response.title ?? file.name.replace(/\.[^.]+$/u, "");
      }
    } else {
      rawText.value = await file.text();
      if (!title.value.trim()) {
        title.value = file.name.replace(/\.[^.]+$/u, "");
      }
    }
    sourceFileName.value = file.name;
    toast.success(`已导入：${file.name}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "文件导入失败。";
    toast.error(error.value);
  } finally {
    importing.value = false;
  }
}

function loadExampleDraft() {
  title.value = EXAMPLE_TITLE;
  rawText.value = EXAMPLE_RAW_TEXT;
  sourceFileName.value = "example-medical-draft.txt";
  error.value = "";
  warning.value = "";
  exportMessage.value = "";
  toast.info("已载入示例文稿");
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
  draftRecoveryMessage.value = "";
  clearStoredWorkbenchDraft();
  toast.info("已清空工作台");
}

async function copyStructuredJson() {
  if (!doc.value) return;
  try {
    await navigator.clipboard.writeText(prettyDoc.value);
    toast.success("结构化 JSON 已复制到剪贴板");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "复制 JSON 失败。";
    toast.error(error.value);
  }
}

/* ---------- 下载 ---------- */
function getDownloadName(format: "docx" | "latex"): string {
  const base = sanitizeFileName(doc.value?.metadata.title || title.value || "document");
  return format === "docx" ? `${base}.docx` : `${base}.tex`;
}

function getDirectDocxDownloadName(): string {
  return `${sanitizeFileName(title.value || "document")}.docx`;
}

function getMimeType(format: "docx" | "latex"): string {
  return format === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/x-tex; charset=utf-8";
}

async function saveExportBlob(blob: Blob, fileName: string, format: "docx" | "latex"): Promise<boolean> {
  const pickerWindow = window as PickerWindow;
  if (downloadWithPicker.value && pickerWindow.showSaveFilePicker) {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [{
        description: format === "docx" ? "Word Document" : "LaTeX File",
        accept: { [getMimeType(format)]: [format === "docx" ? ".docx" : ".tex"] },
      }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return false;
}

/* ---------- 纯函数工具 ---------- */
function loadStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch { /* ignore */ }
  return fallback;
}

function loadStoredStyleSettings(): ExportStyleSettings {
  try {
    const raw = window.localStorage.getItem(EXPORT_STYLE_KEY);
    if (!raw) return { ...DEFAULT_STYLE };
    const parsed = JSON.parse(raw) as Partial<ExportStyleSettings>;
    return {
      styleProfileId: typeof parsed.styleProfileId === "string" ? parsed.styleProfileId : DEFAULT_STYLE.styleProfileId,
      bodyFontSizePt: toNumber(parsed.bodyFontSizePt, DEFAULT_STYLE.bodyFontSizePt),
      lineSpacing: toNumber(parsed.lineSpacing, DEFAULT_STYLE.lineSpacing),
      marginTopMm: toNumber(parsed.marginTopMm, DEFAULT_STYLE.marginTopMm),
      marginBottomMm: toNumber(parsed.marginBottomMm, DEFAULT_STYLE.marginBottomMm),
      marginLeftMm: toNumber(parsed.marginLeftMm, DEFAULT_STYLE.marginLeftMm),
      marginRightMm: toNumber(parsed.marginRightMm, DEFAULT_STYLE.marginRightMm),
    };
  } catch {
    return { ...DEFAULT_STYLE };
  }
}

function toNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatDraftTime(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatRecentDocumentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function sanitizeFileName(value: string): string {
  return value
    .trim()
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\x00-\x1f-]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "document";
}

function extractDownloadName(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) return undefined;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try { return decodeURIComponent(utf8Match[1]); } catch { return utf8Match[1]; }
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
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function countBlocks(blocks: readonly BlockNode[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === "section") return total + 1 + countBlocks(block.children);
    return total + 1;
  }, 0);
}

function countSections(blocks: readonly BlockNode[]): number {
  return blocks.reduce((total, block) => {
    if (block.type !== "section") return total;
    return total + 1 + countSections((block as SectionBlock).children);
  }, 0);
}

function splitRawTextIntoParagraphs(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function isStoredDoc(value: unknown): value is Doc {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<Doc>;
  return (
    typeof candidate.version === "number" &&
    Boolean(candidate.metadata) &&
    typeof candidate.metadata === "object" &&
    Array.isArray(candidate.children)
  );
}
</script>

<style scoped>
/* ===== 页面布局 ===== */
.workbench-page {
  min-height: 100vh;
  color: var(--color-text);
  font-family: var(--font-sans);
  position: relative;
  z-index: 1;
}

/* ===== 顶部导航 — 玻璃拟态 ===== */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  background: rgba(15, 15, 26, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
}

.logo {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.toolbar-nav {
  display: flex;
  gap: var(--space-1);
  padding: 4px;
  background: var(--color-bg-glass);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.nav-link {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: all var(--duration-fast) var(--ease-out);
}

.nav-link:hover {
  color: var(--color-text);
  background: var(--color-bg-glass-hover);
}

.nav-link--active,
.nav-link.router-link-active {
  background: var(--color-primary-gradient);
  color: #fff;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

/* ===== 主布局 ===== */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 480px);
  gap: var(--space-5);
  padding: var(--space-6) var(--space-6) var(--space-10);
  max-width: 1440px;
  margin: 0 auto;
}

.panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-normal) var(--ease-out);
}

.panel:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-lg);
}

.panel--dragging {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow), var(--shadow-glow);
}

/* ===== 左侧输入区 ===== */
.input-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-header {
  margin-bottom: var(--space-4);
}

.section-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-desc {
  margin: 8px 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* 模板选择 — 玻璃卡片 */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.template-card {
  position: relative;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-glass);
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.template-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--color-primary-gradient);
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.template-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-3px);
  box-shadow: var(--shadow-glow);
}

.template-card:hover::before {
  opacity: 0.05;
}

.template-card--active {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
  box-shadow: var(--shadow-glow);
}

.template-card--active::before {
  opacity: 0.1;
}

.template-name {
  position: relative;
  font-weight: 600;
  font-size: var(--text-sm);
  margin-bottom: 6px;
  z-index: 1;
}

.template-desc {
  position: relative;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
  z-index: 1;
}

.template-check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary-gradient);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  z-index: 1;
}

/* 快捷指令 — 发光胶囊 */
.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-glass);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.chip::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--color-primary-gradient);
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.chip:hover:not(:disabled) {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
  color: var(--color-primary-light);
}

.chip:hover:not(:disabled)::before {
  opacity: 0.1;
}

.chip:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.chip span {
  position: relative;
  z-index: 1;
}

.chip-icon {
  font-size: 16px;
}

/* 拖拽上传区 — 霓虹边框 */
.upload-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  text-align: center;
  transition: all var(--duration-normal) var(--ease-out);
  background: var(--color-bg-glass);
  position: relative;
  overflow: hidden;
}

.upload-zone::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--color-primary-gradient);
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.upload-zone--active {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-glow);
}

.upload-zone--active::before {
  opacity: 0.05;
}

.upload-zone--has-file {
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.upload-content {
  position: relative;
  z-index: 1;
}

.upload-icon {
  font-size: 40px;
  margin-bottom: var(--space-3);
  filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.3));
}

.upload-file-name {
  font-weight: 600;
  color: var(--color-success);
  font-size: var(--text-md);
}

.upload-text {
  color: var(--color-text-secondary);
  font-size: var(--text-md);
}

.upload-link {
  color: var(--color-primary-light);
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  border-bottom: 1px dashed var(--color-primary);
  transition: all var(--duration-fast);
}

.upload-link:hover {
  color: var(--color-primary);
  border-bottom-style: solid;
}

.upload-link input {
  display: none;
}

.upload-hint {
  margin-top: var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

/* 恢复提示 */
.recovery-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-info-bg);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--color-info);
  backdrop-filter: blur(10px);
}

.recovery-icon {
  font-size: 18px;
}

.recovery-dismiss {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 18px;
  transition: all var(--duration-fast);
}

.recovery-dismiss:hover {
  background: rgba(255,255,255,0.1);
  color: var(--color-text);
}

/* 表单字段 */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field--grow {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.field-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-stats {
  display: flex;
  gap: var(--space-2);
}

.stat-badge {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-bg-glass);
  border: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-weight: 500;
}

.text-input {
  font-size: var(--text-md);
  font-weight: 500;
}

.input--textarea {
  flex: 1;
  min-height: 280px;
  font-size: var(--text-base);
  line-height: 1.8;
  background: var(--color-bg-input);
}

.input--textarea:focus {
  background: var(--color-bg-input-focus);
}

.input--dragging {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}

/* 排版参数 — 玻璃折叠面板 */
.style-details {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-glass);
}

.style-summary {
  padding: var(--space-4);
  cursor: pointer;
  font-weight: 600;
  font-size: var(--text-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  transition: all var(--duration-fast);
}

.style-summary:hover {
  background: var(--color-bg-glass-hover);
}

.style-summary-hint {
  font-weight: 400;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.field--compact {
  margin: 0;
}

.field--compact .field-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.field--compact .input {
  padding: 10px 12px;
  font-size: var(--text-sm);
  background: var(--color-bg-input);
}

.style-actions {
  padding: 0 var(--space-4) var(--space-4);
  display: flex;
  justify-content: flex-end;
}

/* 操作栏 */
.action-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: stretch;
}

.action-secondary {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.btn-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 进度条 — 霓虹效果 */
.progress-bar {
  padding: var(--space-4);
  background: var(--color-bg-glass);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
}

.progress-track {
  height: 4px;
  background: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-3);
}

.progress-fill {
  height: 100%;
  background: var(--color-primary-gradient);
  border-radius: var(--radius-full);
  transition: width 0.3s var(--ease-out);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
}

.progress-message {
  min-height: 20px;
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.4;
  word-break: break-word;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
}

.progress-step {
  color: var(--color-text-muted);
  transition: all var(--duration-fast);
}

.progress-step--active {
  color: var(--color-primary-light);
  font-weight: 600;
  text-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
}

.progress-step--done {
  color: var(--color-success);
}

/* ===== 右侧输出区 ===== */
.output-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  position: sticky;
  top: 80px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.panel-badges {
  display: flex;
  gap: var(--space-2);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
  color: var(--color-text-muted);
}

.empty-illustration {
  font-size: 64px;
  margin-bottom: var(--space-5);
  opacity: 0.5;
  filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.2));
}

.empty-hint {
  font-size: var(--text-sm);
  margin-top: var(--space-3);
  max-width: 280px;
  line-height: 1.6;
}

.empty-state--compact {
  padding: var(--space-6);
}

/* 消息 — 玻璃效果 */
.message {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  backdrop-filter: blur(10px);
  border: 1px solid transparent;
}

.message-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.message-close {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  border-radius: var(--radius-sm);
  opacity: 0.5;
  font-size: 16px;
  transition: all var(--duration-fast);
}

.message-close:hover {
  opacity: 1;
  background: rgba(255,255,255,0.1);
}

/* 文档卡片 — 渐变边框效果 */
.doc-card {
  position: relative;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  overflow: hidden;
}

.doc-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary-gradient);
}

.doc-header {
  margin-bottom: var(--space-4);
}

.doc-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.doc-subtitle {
  margin-top: 6px;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.doc-meta-row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin-top: var(--space-3);
  font-size: var(--text-sm);
}

.doc-meta-label {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-text-secondary);
  min-width: 48px;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.keyword-tag {
  padding: 4px 12px;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary-light);
  font-size: var(--text-xs);
  font-weight: 500;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

/* 大纲卡片 */
.outline-card,
.preview-card,
.export-card,
.save-card,
.recent-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: var(--color-bg-glass);
  backdrop-filter: blur(10px);
  transition: all var(--duration-normal);
}

.outline-card:hover,
.preview-card:hover,
.export-card:hover,
.save-card:hover,
.recent-card:hover {
  border-color: var(--color-border-strong);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.card-header h4 {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.outline-tree {
  font-size: var(--text-sm);
}

/* 排版预览 */
.preview-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.preview-document {
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
}

.preview-page {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  min-height: 200px;
  border: 1px solid var(--color-border);
}

/* 导出 */
.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.download-setting {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.download-setting input[type="checkbox"] {
  accent-color: var(--color-primary);
}

/* 保存 */
.save-card {
  text-align: center;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05));
  border-color: rgba(99, 102, 241, 0.2);
}

/* 最近文档 */
.recent-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-bg-glass);
  border: 1px solid transparent;
  transition: all var(--duration-fast);
}

.recent-item:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.2);
  transform: translateX(4px);
}

.recent-info {
  min-width: 0;
}

.recent-title {
  font-weight: 500;
  font-size: var(--text-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text);
}

.recent-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 4px;
}

.recover-inline {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

/* 调试 */
.debug-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  font-size: var(--text-sm);
  background: var(--color-bg-glass);
}

.debug-card summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: color var(--duration-fast);
}

.debug-card summary:hover {
  color: var(--color-text-secondary);
}

.debug-pre {
  margin: var(--space-4) 0 0;
  max-height: 240px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.4);
  color: #a5b4fc;
  border-radius: var(--radius-md);
  padding: var(--space-4);
  font-size: var(--text-xs);
  line-height: 1.6;
  border: 1px solid var(--color-border);
}

/* 确认对话框 — 玻璃模态 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-6);
  animation: fadeIn 0.2s ease;
}

.modal-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  max-width: 420px;
  width: 100%;
  box-shadow: var(--shadow-xl), var(--shadow-glow);
  animation: slideUp 0.3s var(--ease-out);
}

.modal-card h3 {
  margin: 0 0 var(--space-4);
  font-size: var(--text-xl);
  font-weight: 700;
}

.modal-card p {
  margin: 0 0 var(--space-6);
  color: var(--color-text-secondary);
  line-height: 1.6;
  font-size: var(--text-sm);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.4s var(--ease-out);
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s var(--ease-out);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* 响应式 */
@media (max-width: 1024px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .output-panel {
    max-height: none;
    position: static;
  }

  .style-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .template-grid {
    grid-template-columns: 1fr;
  }

  .style-grid {
    grid-template-columns: 1fr;
  }

  .chips-row {
    justify-content: center;
  }

  .layout {
    padding: var(--space-4);
  }
}
</style>
