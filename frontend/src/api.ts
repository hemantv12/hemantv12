import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

const TOKEN_KEY = "swapkaro_token";

export async function setToken(t: string) {
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function req<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  requestOtp: (phone: string) => req("/auth/request-otp", { method: "POST", body: { phone }, auth: false }),
  verifyOtp: (phone: string, otp: string) =>
    req("/auth/verify-otp", { method: "POST", body: { phone, otp }, auth: false }),
  me: () => req("/me"),
  updateMe: (data: any) => req("/me", { method: "PATCH", body: data }),
  feed: () => req("/feed"),
  user: (id: string) => req(`/users/${id}`),
  aiMatches: () => req("/matches/ai"),
  createSwap: (b: any) => req("/swaps", { method: "POST", body: b }),
  listSwaps: () => req("/swaps"),
  acceptSwap: (id: string) => req(`/swaps/${id}/accept`, { method: "POST" }),
  advance: (id: string) => req(`/swaps/${id}/milestone`, { method: "POST" }),
  messages: (id: string) => req(`/swaps/${id}/messages`),
  sendMsg: (id: string, text: string) => req(`/swaps/${id}/messages`, { method: "POST", body: { text } }),
  askBot: (id: string, question: string) => req(`/swaps/${id}/bot`, { method: "POST", body: { question } }),
  autocomplete: (q: string) => req(`/skills/autocomplete?q=${encodeURIComponent(q)}`),
  quiz: (skill: string) => req("/skills/verify-quiz", { method: "POST", body: { skill } }),
  quizSubmit: (b: any) => req("/skills/verify-submit", { method: "POST", body: b }),
  upgradePro: () => req("/pro/upgrade", { method: "POST" }),
  boost: (hours: number) => req("/boost", { method: "POST", body: { hours } }),
  notifs: () => req("/notifications"),
  seedNotifs: () => req("/notifications/seed", { method: "POST" }),
};
