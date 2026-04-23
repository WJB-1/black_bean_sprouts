import { createRouter, createWebHistory } from "vue-router";
const routes = [
  { path: "/", redirect: "/editor/new" },
  { path: "/editor/:id", component: () => import("../pages/DocumentEditor.vue"), props: true },
  { path: "/admin", component: () => import("../pages/admin/AdminPage.vue") },
];
export default createRouter({ history: createWebHistory(), routes });
