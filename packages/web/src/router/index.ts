import { createRouter, createWebHistory } from "vue-router";
const routes = [
  { path: "/", redirect: "/workbench" },
  { path: "/workbench", component: () => import("../pages/WorkbenchPage.vue") },
  { path: "/editor/:id", component: () => import("../pages/DocumentEditor.vue"), props: true },
  { path: "/admin", component: () => import("../pages/admin/AdminPage.vue") },
];
export default createRouter({ history: createWebHistory(), routes });
