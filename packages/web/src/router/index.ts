import { createRouter, createWebHistory } from "vue-router";
import { clearTokens, getAccessToken } from "../lib/token.js";
import { useAuthStore } from "../stores/auth.js";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../pages/LoginPage.vue"),
    meta: { guest: true },
    props: (route: { query: { redirect?: string } }) => ({
      redirect: route.query.redirect,
    }),
  },
  {
    path: "/",
    redirect: "/documents",
  },
  {
    path: "/home",
    name: "home",
    component: () => import("../pages/HomePage.vue"),
    meta: { auth: true },
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
    props: true,
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
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    redirect: "/documents",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

function isValidDocumentId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id !== "undefined" && id !== "null";
}

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const token = getAccessToken();
  const requiresAuth = to.meta["auth"] === true;
  const isGuestRoute = to.meta["guest"] === true;

  if (token && !authStore.user) {
    await authStore.fetchUser();
  }

  if (requiresAuth && !authStore.user) {
    if (token) {
      clearTokens();
    }
    return {
      name: "login",
      query: { redirect: to.fullPath },
    };
  }

  if (isGuestRoute && authStore.user) {
    return { name: "documents" };
  }

  if (to.name === "document-edit" && !isValidDocumentId(to.params["id"])) {
    return { name: "documents" };
  }

  return true;
});

export default router;
