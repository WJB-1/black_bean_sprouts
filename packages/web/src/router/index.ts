import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../pages/LoginPage.vue"),
    meta: { guest: true },
    // Save redirect query param for post-login redirect
    props: (route: { query: { redirect?: string } }) => ({ redirect: route.query.redirect }),
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
    // Validate ID format
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
    // Catch-all for 404
    path: "/:pathMatch(.*)*",
    name: "not-found",
    redirect: "/documents",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Validate document ID format
function isValidDocumentId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id !== "undefined" && id !== "null";
}

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Check if route requires authentication
  const requiresAuth = to.meta["auth"] === true;
  const isGuestRoute = to.meta["guest"] === true;

  // Get token from localStorage
  const token = localStorage.getItem("bbs_access_token");

  // If no token and route requires auth, redirect to login
  if (requiresAuth && !token) {
    return next({
      name: "login",
      query: { redirect: to.fullPath },
    });
  }

  // If has token and on guest route, redirect to documents
  if (isGuestRoute && token) {
    return next({ name: "documents" });
  }

  // Validate token for protected routes
  if (requiresAuth && token) {
    // Try to fetch user profile if not already loaded
    if (!authStore.user) {
      try {
        await authStore.fetchUser();
        // If fetchUser returns successfully but user is null, token is invalid
        if (!authStore.user) {
          localStorage.removeItem("bbs_access_token");
          return next({
            name: "login",
            query: { redirect: to.fullPath },
          });
        }
      } catch {
        // Token is invalid or expired
        localStorage.removeItem("bbs_access_token");
        return next({
          name: "login",
          query: { redirect: to.fullPath },
        });
      }
    }
  }

  // Validate document ID for document-edit route
  if (to.name === "document-edit") {
    const docId = to.params["id"];
    if (!isValidDocumentId(docId)) {
      return next({ name: "documents" });
    }
  }

  next();
});

export default router;
