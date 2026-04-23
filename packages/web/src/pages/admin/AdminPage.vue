<template>
  <div class="admin-page">
    <header><h1>管理后台</h1></header>
    <nav class="tabs">
      <button v-for="tab in tabs" :key="tab.key" :class="{ active: currentTab === tab.key }" @click="currentTab = tab.key">
        {{ tab.label }}
      </button>
    </nav>
    <main class="content">
      <section v-if="currentTab === 'profiles'">
        <h2>Style Profiles</h2>
        <button class="btn-primary" @click="showCreateProfile = true">+ 新建</button>
        <div v-if="showCreateProfile" class="form">
          <input v-model="newProfile.name" placeholder="Profile name" />
          <textarea v-model="newProfile.dsl" placeholder="DSL JSON..." rows="5" />
          <button @click="createProfile">创建</button>
          <button @click="showCreateProfile = false">取消</button>
        </div>
        <ul class="item-list">
          <li v-for="p in profiles" :key="p.id">{{ (p as any).name }} <span :class="['badge', (p as any).enabled ? 'enabled' : 'disabled']">{{ (p as any).enabled ? '启用' : '禁用' }}</span></li>
        </ul>
      </section>
      <section v-if="currentTab === 'doctypes'">
        <h2>Doc Types</h2>
        <button class="btn-primary" @click="showCreateDocType = true">+ 新建</button>
        <div v-if="showCreateDocType" class="form">
          <input v-model="newDocType.name" placeholder="Type name" />
          <input v-model="newDocType.description" placeholder="Description" />
          <button @click="createDocType">创建</button>
          <button @click="showCreateDocType = false">取消</button>
        </div>
        <ul class="item-list">
          <li v-for="d in docTypes" :key="d.id">{{ (d as any).name }} - {{ (d as any).description }}</li>
        </ul>
      </section>
      <section v-if="currentTab === 'skills'">
        <h2>Skills</h2>
        <button class="btn-primary" @click="showCreateSkill = true">+ 新建</button>
        <div v-if="showCreateSkill" class="form">
          <input v-model="newSkill.name" placeholder="Skill name" />
          <input v-model="newSkill.tools" placeholder="Tools (comma separated)" />
          <button @click="createSkill">创建</button>
          <button @click="showCreateSkill = false">取消</button>
        </div>
        <ul class="item-list">
          <li v-for="s in skills" :key="s.id">{{ (s as any).name }} - Tools: {{ (s as any).tools?.join(", ") }}</li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const tabs = [
  { key: "profiles", label: "Style Profiles" },
  { key: "doctypes", label: "Doc Types" },
  { key: "skills", label: "Skills" },
];
const currentTab = ref("profiles");

const profiles = ref<any[]>([]);
const docTypes = ref<any[]>([]);
const skills = ref<any[]>([]);

const showCreateProfile = ref(false);
const showCreateDocType = ref(false);
const showCreateSkill = ref(false);

const newProfile = ref({ name: "", dsl: "{}" });
const newDocType = ref({ name: "", description: "" });
const newSkill = ref({ name: "", tools: "" });

async function loadProfiles() {
  try { const r = await fetch("/api/admin/style-profiles"); profiles.value = await r.json() as any[]; } catch {}
}
async function loadDocTypes() {
  try { const r = await fetch("/api/admin/doc-types"); docTypes.value = await r.json() as any[]; } catch {}
}
async function loadSkills() {
  try { const r = await fetch("/api/admin/skills"); skills.value = await r.json() as any[]; } catch {}
}

async function createProfile() {
  await fetch("/api/admin/style-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newProfile.value.name, dsl: JSON.parse(newProfile.value.dsl) }) });
  showCreateProfile.value = false;
  await loadProfiles();
}
async function createDocType() {
  await fetch("/api/admin/doc-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newDocType.value) });
  showCreateDocType.value = false;
  await loadDocTypes();
}
async function createSkill() {
  await fetch("/api/admin/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newSkill.value.name, tools: newSkill.value.tools.split(",").map((t: string) => t.trim()) }) });
  showCreateSkill.value = false;
  await loadSkills();
}

onMounted(() => { loadProfiles(); loadDocTypes(); loadSkills(); });
</script>

<style scoped>
.admin-page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
.tabs { display: flex; gap: 0.5rem; margin: 1rem 0; }
.tabs button { padding: 0.5rem 1rem; border: 1px solid #ddd; background: white; cursor: pointer; border-radius: 4px; }
.tabs button.active { background: #333; color: white; }
.btn-primary { background: #4f46e5; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
.form { border: 1px solid #ddd; padding: 1rem; margin: 1rem 0; border-radius: 4px; }
.form input, .form textarea { width: 100%; margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
.item-list { list-style: none; padding: 0; }
.item-list li { padding: 0.75rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
.badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
.badge.enabled { background: #dcfce7; color: #166534; }
.badge.disabled { background: #fee2e2; color: #991b1b; }
</style>
