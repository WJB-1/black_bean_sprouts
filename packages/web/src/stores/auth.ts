import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { apiFetch } from "../lib/api.js";
import { clearTokens, getAccessToken, setAccessToken } from "../lib/token.js";

interface UserProfile {
  id: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  tier: string;
}

interface LoginPayload {
  accessToken: string;
  user: UserProfile;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserProfile | null>(null);
  const isLoggedIn = computed(() => user.value !== null);

  function applySession(payload: LoginPayload): void {
    setAccessToken(payload.accessToken);
    user.value = payload.user;
  }

  async function smsLogin(phone: string, code: string): Promise<void> {
    const payload = await apiFetch<LoginPayload>("/auth/sms/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });
    applySession(payload);
  }

  async function fetchUser(): Promise<void> {
    try {
      user.value = await apiFetch<UserProfile>("/auth/me");
    } catch {
      user.value = null;
    }
  }

  function logout(): void {
    clearTokens();
    user.value = null;
  }

  if (getAccessToken() && !user.value) {
    void fetchUser();
  }

  return { user, isLoggedIn, applySession, smsLogin, fetchUser, logout };
});
