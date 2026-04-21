export interface AuthPayload {
  userId: string;
  tier: string;
}

export interface TokenPair {
  accessToken: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    nickname: string | null;
    phone: string | null;
    avatarUrl: string | null;
    tier: string;
  };
}
