<template>
  <div class="admin-page">
    <header class="hero">
      <div>
        <p class="kicker">Admin Console</p>
        <h1>Black Bean Sprouts Control Plane</h1>
        <p class="copy">
          This is the backend-facing frontend. The user-facing product stays at
          <router-link to="/workbench">/workbench</router-link>.
        </p>
      </div>
      <div class="hero-actions">
        <router-link class="ghost" to="/workbench">Open Workbench</router-link>
        <button v-if="authed" class="ghost" type="button" @click="logout">Logout</button>
      </div>
    </header>

    <section v-if="!authed" class="panel">
      <h2>Admin Login</h2>
      <p>Use an email containing <code>admin</code>. The backend will issue an ADMIN token.</p>
      <form class="grid two" @submit.prevent="login">
        <input :value="loginForm.email" class="input" type="email" placeholder="admin@example.com" @input="setLogin('email', $event)" />
        <input :value="loginForm.name" class="input" type="text" placeholder="Admin" @input="setLogin('name', $event)" />
        <button class="primary" type="submit" :disabled="busy">{{ busy ? "Logging in..." : "Login" }}</button>
      </form>
      <p v-if="message" class="message">{{ message }}</p>
    </section>

    <template v-else>
      <section class="stats">
        <article class="stat">
          <span>Workbench</span>
          <strong>{{ snapshot?.overview.workbenchUrl ?? "-" }}</strong>
        </article>
        <article class="stat">
          <span>Prompt</span>
          <strong>{{ snapshot?.overview.promptProvider ?? "-" }}</strong>
        </article>
        <article class="stat">
          <span>Billing</span>
          <strong>{{ billingProviders }}</strong>
        </article>
        <article class="stat warning">
          <span>Pending Restart</span>
          <strong>{{ snapshot?.pendingRestartCount ?? 0 }}</strong>
        </article>
      </section>

      <nav class="tabs">
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: currentTab === tab.key }" @click="currentTab = tab.key">
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="currentTab === 'overview'" class="panel">
        <h2>Overview</h2>
        <p class="message">{{ snapshot?.overview.loginHint }}</p>
        <div class="grid three">
          <article class="card">
            <h3>LLM Selection</h3>
            <p>{{ snapshot?.overview.llmSelection ?? "not configured" }}</p>
          </article>
          <article class="card">
            <h3>Infrastructure</h3>
            <p>{{ infraSummary }}</p>
          </article>
          <article class="card">
            <h3>Payment Readiness</h3>
            <p>{{ paymentSummary }}</p>
          </article>
        </div>
      </section>

      <section v-if="currentTab === 'setup'" class="panel">
        <div class="row">
          <div>
            <h2>Setup</h2>
            <p>All startup settings are editable here and saved into <code>.env</code>.</p>
          </div>
          <div class="row">
            <button class="ghost" type="button" :disabled="busy" @click="loadConsole">Reload</button>
            <button class="primary" type="button" :disabled="busy" @click="saveSettings">{{ busy ? "Saving..." : "Save Settings" }}</button>
          </div>
        </div>
        <p v-if="message" class="message">{{ message }}</p>
        <article v-for="section in snapshot?.sections ?? []" :key="section.key" class="section-card">
          <div class="row">
            <div>
              <h3>{{ section.label }}</h3>
              <p>{{ section.description }}</p>
            </div>
            <small>{{ section.restartNote }}</small>
          </div>
          <div class="grid two">
            <label v-for="field in section.fields" :key="field.key" class="field">
              <span>{{ field.label }}</span>
              <small>{{ field.description }}</small>
              <select v-if="field.input === 'select'" class="input" :value="readText(field.key)" @change="setDraft(field.key, $event)">
                <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <textarea
                v-else-if="field.input === 'textarea'"
                class="input area"
                rows="6"
                :value="readText(field.key)"
                :placeholder="field.placeholder ?? ''"
                @input="setDraft(field.key, $event)"
              />
              <label v-else-if="field.input === 'boolean'" class="toggle">
                <input type="checkbox" :checked="readBool(field.key)" @change="setDraftBool(field.key, $event)" />
                <span>{{ readBool(field.key) ? "Enabled" : "Disabled" }}</span>
              </label>
              <input
                v-else
                class="input"
                :type="field.input === 'password' ? 'password' : field.input === 'number' ? 'number' : 'text'"
                :value="readText(field.key)"
                :placeholder="field.placeholder ?? ''"
                @input="setDraft(field.key, $event)"
              />
              <small :class="field.pendingRestart ? 'warn' : 'ok'">
                {{ field.pendingRestart ? "Saved value differs from active runtime" : "Active runtime matches saved value" }}
              </small>
            </label>
          </div>
        </article>
      </section>

      <section v-if="currentTab === 'profiles'" class="panel">
        <h2>Style Profiles</h2>
        <form class="grid two" @submit.prevent="createProfile">
          <input :value="newProfile.name" class="input" placeholder="New profile name" @input="setNewProfile('name', $event)" />
          <button class="primary" type="submit" :disabled="busy">Create</button>
          <textarea :value="newProfile.dsl" class="input area full" rows="5" @input="setNewProfile('dsl', $event)" />
        </form>
        <div class="stack">
          <article v-for="item in profiles" :key="item.id" class="card">
            <div class="row">
              <strong>{{ item.name }}</strong>
              <button class="ghost" type="button" :disabled="busy" @click="toggleProfile(item)">{{ item.enabled ? "Disable" : "Enable" }}</button>
            </div>
            <input class="input" :value="profileDrafts[item.id]?.name ?? item.name" @input="setProfileDraft(item.id, 'name', $event)" />
            <textarea class="input area" rows="5" :value="profileDrafts[item.id]?.dsl ?? '{}'" @input="setProfileDraft(item.id, 'dsl', $event)" />
            <button class="primary fit" type="button" :disabled="busy" @click="saveProfile(item.id)">Save</button>
          </article>
        </div>
      </section>

      <section v-if="currentTab === 'doctypes'" class="panel">
        <h2>Document Types</h2>
        <form class="grid three" @submit.prevent="createDocType">
          <input :value="newDocType.name" class="input" placeholder="Type name" @input="setNewDocType('name', $event)" />
          <input :value="newDocType.description" class="input" placeholder="Description" @input="setNewDocType('description', $event)" />
          <button class="primary" type="submit" :disabled="busy">Create</button>
        </form>
        <div class="stack">
          <article v-for="item in docTypes" :key="item.id" class="card">
            <div class="row">
              <strong>{{ item.name }}</strong>
              <button class="ghost" type="button" :disabled="busy" @click="toggleDocType(item)">{{ item.enabled ? "Disable" : "Enable" }}</button>
            </div>
            <input class="input" :value="docTypeDrafts[item.id]?.name ?? item.name" @input="setDocTypeDraft(item.id, 'name', $event)" />
            <input class="input" :value="docTypeDrafts[item.id]?.description ?? item.description ?? ''" @input="setDocTypeDraft(item.id, 'description', $event)" />
            <button class="primary fit" type="button" :disabled="busy" @click="saveDocType(item.id)">Save</button>
          </article>
        </div>
      </section>

      <section v-if="currentTab === 'skills'" class="panel">
        <h2>Skills</h2>
        <form class="grid two" @submit.prevent="createSkill">
          <input :value="newSkill.name" class="input" placeholder="Skill name" @input="setNewSkill('name', $event)" />
          <input :value="newSkill.description" class="input" placeholder="Description" @input="setNewSkill('description', $event)" />
          <textarea :value="newSkill.tools" class="input area full" rows="3" placeholder="tool-a, tool-b" @input="setNewSkill('tools', $event)" />
          <button class="primary" type="submit" :disabled="busy">Create</button>
        </form>
        <div class="stack">
          <article v-for="item in skills" :key="item.id" class="card">
            <div class="row">
              <strong>{{ item.name }}</strong>
              <button class="ghost" type="button" :disabled="busy" @click="toggleSkill(item)">{{ item.enabled ? "Disable" : "Enable" }}</button>
            </div>
            <input class="input" :value="skillDrafts[item.id]?.name ?? item.name" @input="setSkillDraft(item.id, 'name', $event)" />
            <input class="input" :value="skillDrafts[item.id]?.description ?? item.description ?? ''" @input="setSkillDraft(item.id, 'description', $event)" />
            <textarea class="input area" rows="3" :value="skillDrafts[item.id]?.tools ?? item.tools.join(', ')" @input="setSkillDraft(item.id, 'tools', $event)" />
            <button class="primary fit" type="button" :disabled="busy" @click="saveSkill(item.id)">Save</button>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { apiFetch, clearApiToken, setApiToken } from "../../lib/api.js";

type TabKey = "overview" | "setup" | "profiles" | "doctypes" | "skills";
type RuntimeField = { key: string; label: string; description: string; input: "text" | "textarea" | "password" | "boolean" | "select" | "number"; placeholder?: string; options?: { value: string; label: string }[]; pendingRestart: boolean; persistedValue: string; activeValue: string };
type RuntimeSection = { key: string; label: string; description: string; restartNote: string; fields: RuntimeField[] };
type RuntimeSnapshot = {
  pendingRestartCount: number;
  overview: {
    workbenchUrl: string;
    promptProvider: string;
    llmSelection: string;
    billingProviders: string[];
    loginHint: string;
    infrastructure: { databaseConfigured: boolean; redisConfigured: boolean; minioConfigured: boolean };
    paymentReadiness: { developer: boolean; stripe: boolean; alipay: boolean; wechatpay: boolean };
  };
  sections: RuntimeSection[];
};
type LoginResponse = { token: string; user: { role: "USER" | "ADMIN" } };
type StyleProfile = { id: string; name: string; dsl: unknown; enabled: boolean };
type DocType = { id: string; name: string; description?: string | null; enabled: boolean };
type Skill = { id: string; name: string; description?: string | null; tools: string[]; enabled: boolean };

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "setup", label: "Setup" },
  { key: "profiles", label: "Style Profiles" },
  { key: "doctypes", label: "Doc Types" },
  { key: "skills", label: "Skills" },
] satisfies { key: TabKey; label: string }[];

const currentTab = ref<TabKey>("overview");
const authed = ref(false);
const busy = ref(false);
const message = ref("");
const snapshot = ref<RuntimeSnapshot | null>(null);
const drafts = reactive<Record<string, string | boolean>>({});
const loginForm = reactive({ email: "admin@example.com", name: "Admin" });
const newProfile = reactive({ name: "", dsl: "{\n  \"bodyFontSizePt\": 12\n}" });
const newDocType = reactive({ name: "", description: "" });
const newSkill = reactive({ name: "", description: "", tools: "" });
const profiles = ref<StyleProfile[]>([]);
const docTypes = ref<DocType[]>([]);
const skills = ref<Skill[]>([]);
const profileDrafts = reactive<Record<string, { name: string; dsl: string }>>({});
const docTypeDrafts = reactive<Record<string, { name: string; description: string }>>({});
const skillDrafts = reactive<Record<string, { name: string; description: string; tools: string }>>({});

const billingProviders = computed(() => snapshot.value?.overview.billingProviders.join(", ") || "-");
const infraSummary = computed(() => {
  const infra = snapshot.value?.overview.infrastructure;
  if (!infra) return "-";
  return [
    infra.databaseConfigured ? "database" : "database missing",
    infra.redisConfigured ? "redis" : "redis missing",
    infra.minioConfigured ? "minio" : "minio missing",
  ].join(" / ");
});
const paymentSummary = computed(() => {
  const payment = snapshot.value?.overview.paymentReadiness;
  if (!payment) return "-";
  return Object.entries(payment).filter(([, ready]) => ready).map(([name]) => name).join(", ") || "none ready";
});

onMounted(async () => {
  const token = window.localStorage.getItem("bbs-auth-token");
  if (!token) return;
  authed.value = true;
  setApiToken(token);
  try {
    await loadAll();
  } catch (error) {
    logout();
    message.value = readError(error);
  }
});

async function login() {
  busy.value = true;
  message.value = "";
  try {
    const result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(loginForm),
    });
    if (result.user.role !== "ADMIN") throw new Error("Use an email containing 'admin' to enter the control plane.");
    setApiToken(result.token);
    authed.value = true;
    await loadAll();
    message.value = "Admin session ready.";
  } catch (error) {
    clearApiToken();
    authed.value = false;
    message.value = readError(error);
  } finally {
    busy.value = false;
  }
}

function logout() {
  clearApiToken();
  authed.value = false;
  snapshot.value = null;
  message.value = "Admin session cleared.";
}

async function loadAll() {
  await Promise.all([loadConsole(), loadProfiles(), loadDocTypes(), loadSkills()]);
}

async function loadConsole() {
  snapshot.value = await apiFetch<RuntimeSnapshot>("/admin/runtime-settings");
  for (const section of snapshot.value.sections) {
    for (const field of section.fields) {
      drafts[field.key] = field.input === "boolean" ? field.persistedValue === "true" : field.persistedValue;
    }
  }
}

async function saveSettings() {
  busy.value = true;
  message.value = "";
  try {
    snapshot.value = await apiFetch<RuntimeSnapshot>("/admin/runtime-settings", {
      method: "PUT",
      body: JSON.stringify({ values: drafts }),
    });
    for (const section of snapshot.value.sections) {
      for (const field of section.fields) {
        drafts[field.key] = field.input === "boolean" ? field.persistedValue === "true" : field.persistedValue;
      }
    }
    message.value = `Saved to .env. Pending restart count: ${snapshot.value.pendingRestartCount}.`;
  } catch (error) {
    message.value = readError(error);
  } finally {
    busy.value = false;
  }
}

async function loadProfiles() {
  profiles.value = await apiFetch<StyleProfile[]>("/admin/style-profiles");
  for (const item of profiles.value) profileDrafts[item.id] = { name: item.name, dsl: JSON.stringify(item.dsl ?? {}, null, 2) };
}
async function loadDocTypes() {
  docTypes.value = await apiFetch<DocType[]>("/admin/doc-types");
  for (const item of docTypes.value) docTypeDrafts[item.id] = { name: item.name, description: item.description ?? "" };
}
async function loadSkills() {
  skills.value = await apiFetch<Skill[]>("/admin/skills");
  for (const item of skills.value) skillDrafts[item.id] = { name: item.name, description: item.description ?? "", tools: item.tools.join(", ") };
}

async function createProfile() { await mutate(async () => { await apiFetch("/admin/style-profiles", { method: "POST", body: JSON.stringify({ name: newProfile.name, dsl: JSON.parse(newProfile.dsl) }) }); newProfile.name = ""; await loadProfiles(); message.value = "Style profile created."; }); }
async function saveProfile(id: string) { await mutate(async () => { const draft = profileDrafts[id]; if (!draft) throw new Error("Missing style profile draft."); await apiFetch(`/admin/style-profiles/${id}`, { method: "PUT", body: JSON.stringify({ name: draft.name, dsl: JSON.parse(draft.dsl) }) }); await loadProfiles(); message.value = "Style profile updated."; }); }
async function toggleProfile(item: StyleProfile) { await mutate(async () => { await apiFetch(`/admin/style-profiles/${item.id}/toggle`, { method: "PATCH", body: JSON.stringify({ enabled: !item.enabled }) }); await loadProfiles(); }); }

async function createDocType() { await mutate(async () => { await apiFetch("/admin/doc-types", { method: "POST", body: JSON.stringify(newDocType) }); newDocType.name = ""; newDocType.description = ""; await loadDocTypes(); message.value = "Document type created."; }); }
async function saveDocType(id: string) { await mutate(async () => { const draft = docTypeDrafts[id]; if (!draft) throw new Error("Missing document type draft."); await apiFetch(`/admin/doc-types/${id}`, { method: "PUT", body: JSON.stringify(draft) }); await loadDocTypes(); message.value = "Document type updated."; }); }
async function toggleDocType(item: DocType) { await mutate(async () => { await apiFetch(`/admin/doc-types/${item.id}/toggle`, { method: "PATCH", body: JSON.stringify({ enabled: !item.enabled }) }); await loadDocTypes(); }); }

async function createSkill() { await mutate(async () => { await apiFetch("/admin/skills", { method: "POST", body: JSON.stringify({ name: newSkill.name, description: newSkill.description, tools: splitTools(newSkill.tools) }) }); newSkill.name = ""; newSkill.description = ""; newSkill.tools = ""; await loadSkills(); message.value = "Skill created."; }); }
async function saveSkill(id: string) { await mutate(async () => { const draft = skillDrafts[id]; if (!draft) throw new Error("Missing skill draft."); await apiFetch(`/admin/skills/${id}`, { method: "PUT", body: JSON.stringify({ name: draft.name, description: draft.description, tools: splitTools(draft.tools) }) }); await loadSkills(); message.value = "Skill updated."; }); }
async function toggleSkill(item: Skill) { await mutate(async () => { await apiFetch(`/admin/skills/${item.id}/toggle`, { method: "PATCH", body: JSON.stringify({ enabled: !item.enabled }) }); await loadSkills(); }); }

async function mutate(run: () => Promise<void>) {
  busy.value = true;
  message.value = "";
  try { await run(); } catch (error) { message.value = readError(error); } finally { busy.value = false; }
}

function readText(key: string) { const value = drafts[key]; return typeof value === "string" ? value : value ? "true" : ""; }
function readBool(key: string) { return drafts[key] === true; }
function setDraft(key: string, event: Event) { drafts[key] = readValue(event); }
function setDraftBool(key: string, event: Event) { drafts[key] = (event.target as HTMLInputElement | null)?.checked ?? false; }
function setLogin(key: "email" | "name", event: Event) { loginForm[key] = readValue(event); }
function setNewProfile(key: "name" | "dsl", event: Event) { newProfile[key] = readValue(event); }
function setNewDocType(key: "name" | "description", event: Event) { newDocType[key] = readValue(event); }
function setNewSkill(key: "name" | "description" | "tools", event: Event) { newSkill[key] = readValue(event); }
function setProfileDraft(id: string, key: "name" | "dsl", event: Event) { const draft = profileDrafts[id]; if (!draft) return; draft[key] = readValue(event); }
function setDocTypeDraft(id: string, key: "name" | "description", event: Event) { const draft = docTypeDrafts[id]; if (!draft) return; draft[key] = readValue(event); }
function setSkillDraft(id: string, key: "name" | "description" | "tools", event: Event) { const draft = skillDrafts[id]; if (!draft) return; draft[key] = readValue(event); }
function splitTools(raw: string) { return raw.split(",").map((item) => item.trim()).filter(Boolean); }
function readValue(event: Event) { return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value ?? ""; }
function readError(error: unknown) { return error instanceof Error ? error.message : String(error); }
</script>

<style scoped>
.admin-page { min-height: 100vh; padding: 24px; background: linear-gradient(180deg, #10151d 0%, #1a2029 100%); color: #edf2f7; font-family: "IBM Plex Sans", "Segoe UI", "Microsoft YaHei UI", sans-serif; }
.hero, .panel, .stat, .card, .section-card { border: 1px solid rgba(255,255,255,.08); background: rgba(10,14,20,.78); border-radius: 20px; box-shadow: 0 18px 40px rgba(0,0,0,.18); }
.hero, .row, .hero-actions, .tabs, .stats, .grid, .stack, .toggle { display: flex; gap: 16px; }
.hero, .row { justify-content: space-between; align-items: flex-start; }
.hero { padding: 24px; margin-bottom: 24px; }
.hero h1, .panel h2, .card h3 { margin: 0; }
.kicker { margin: 0 0 8px; color: #efbe7a; text-transform: uppercase; letter-spacing: .18em; font-size: 12px; }
.copy, .panel p, .field small, .message, .section-card small { color: #a9b3c2; line-height: 1.6; }
.hero-actions, .tabs, .stats, .stack { flex-wrap: wrap; }
.ghost, .primary, .tabs button { min-height: 42px; padding: 0 16px; border-radius: 999px; font: inherit; }
.ghost, .tabs button { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: #f7e4c4; text-decoration: none; cursor: pointer; }
.primary { border: 0; background: linear-gradient(135deg, #c9872f 0%, #f0be79 100%); color: #16110a; font-weight: 700; cursor: pointer; }
.tabs button.active { background: rgba(240,190,121,.16); border-color: rgba(240,190,121,.35); color: #fff4df; }
.panel { padding: 24px; margin-bottom: 24px; }
.stats { margin-bottom: 24px; }
.stat, .card, .section-card { padding: 18px; }
.stat { flex: 1 1 220px; }
.warning { border-color: rgba(240,190,121,.35); }
.stat span { display: block; color: #9aa5b5; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }
.stat strong { display: block; margin-top: 10px; line-height: 1.5; word-break: break-word; }
.grid { flex-wrap: wrap; }
.grid.two > * { flex: 1 1 280px; }
.grid.three > * { flex: 1 1 220px; }
.full { flex-basis: 100%; }
.input { width: 100%; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; background: rgba(255,255,255,.04); color: #f4f7fb; padding: 12px 14px; font: inherit; }
.area { min-height: 120px; resize: vertical; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field span { font-weight: 700; }
.section-card { margin-top: 20px; }
.stack { flex-direction: column; margin-top: 20px; }
.fit { width: fit-content; }
.ok { color: #8ce8c1; }
.warn { color: #f5d59f; }
code { padding: 2px 6px; border-radius: 8px; background: rgba(255,255,255,.08); color: #ffe3bb; }
@media (max-width: 900px) { .admin-page { padding: 16px; } .hero, .row { flex-direction: column; } }
</style>
