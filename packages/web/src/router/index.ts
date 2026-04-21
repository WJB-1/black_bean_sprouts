import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../pages/LoginPage.vue"),
    meta: { guest: true },
  },
  {
    path: "/",
    redirect: "/documents",
  },
  {
    path: "/documents",
    name: "documents",
    component: () => import("../pages/DocumentListPage.vue"),
    meta: { auth: true },
  },
  {
    path: "/documents/:id",
    name: "document-edit",
    component: () => import("../pages/DocumentEditPage.vue"),
    meta: { auth: true },
  },
  {
    path: "/admin",
    component: () => import("../pages/admin/AdminLayout.vue"),
    meta: { auth: true },
    children: [
      { path: "", redirect: "/admin/style-profiles" },
      {
        path: "style-profiles",
        name: "style-profiles",
        component: () => import("../pages/admin/StyleProfileList.vue"),
      },
      {
        path: "doc-types",
        name: "doc-types",
        component: () => import("../pages/admin/DocTypeList.vue"),
      },
      {
        path: "skills",
        name: "skills",
        component: () => import("../pages/admin/SkillList.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const token = localStorage.getItem("bbs_access_token");
  if (to.meta["auth"] && !token) {
    return { name: "login" };
  }
  if (to.meta["guest"] && token) {
    return { name: "documents" };
  }
});

export default router;
