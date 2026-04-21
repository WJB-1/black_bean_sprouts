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
    name: "home",
    component: () => import("../pages/HomePage.vue"),
    meta: { auth: true },
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
    return { name: "home" };
  }
});

export default router;
