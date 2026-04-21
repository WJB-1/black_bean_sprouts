import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiFetch } from "../lib/api.js";
import { setAccessToken, clearTokens, getAccessToken } from "../lib/token.js";

interface UserProfile {
  id: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  tier: string;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserProfile | null>(null);
  const isLoggedIn = computed(() => user.value !== null);

  async function smsLogin(phone: string, code: string) {
    const res = await apiFetch<{ accessToken: string; user: UserProfile }>(
      "/auth/sms/verify",
      {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      },
    );
    setAccessToken(res.accessToken);
    user.value = res.user;
  }

  async function fetchUser() {
    try {
      const profile = await apiFetch<UserProfile>("/auth/me");
      user.value = profile;
    } catch {
      user.value = null;
    }
  }

  function logout() {
    clearTokens();
    user.value = null;
  }

  // Auto-restore session on store init
  if (getAccessToken() && !user.value) {
    void fetchUser();
  }

  return { user, isLoggedIn, smsLogin, fetchUser, logout };
});
