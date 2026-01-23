const GUEST_TOKEN_KEY = "warimeshi_guest_token";
const GUEST_USER_ID_KEY = "warimeshi_guest_user_id";

export function getGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function getGuestUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUEST_USER_ID_KEY);
}

export function setGuestSession(token: string, userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_TOKEN_KEY, token);
  localStorage.setItem(GUEST_USER_ID_KEY, userId);
}

export function clearGuestSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_TOKEN_KEY);
  localStorage.removeItem(GUEST_USER_ID_KEY);
}

export function hasGuestSession(): boolean {
  return !!getGuestToken();
}

export interface GuestSession {
  token: string;
  userId: string;
}

export async function validateGuestToken(token: string): Promise<{ valid: boolean; userId?: string; nickname?: string }> {
  try {
    const response = await fetch(`/api/auth/guest?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
      return { valid: false };
    }
    const data = await response.json();
    return { valid: true, userId: data.userId, nickname: data.nickname };
  } catch {
    return { valid: false };
  }
}

export async function getOrCreateGuestSession(displayName?: string): Promise<GuestSession> {
  const existingToken = getGuestToken();
  const existingUserId = getGuestUserId();

  if (existingToken && existingUserId) {
    const validation = await validateGuestToken(existingToken);
    if (validation.valid && validation.userId) {
      return { token: existingToken, userId: validation.userId };
    }
    clearGuestSession();
  }

  const response = await fetch("/api/auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });

  if (!response.ok) {
    throw new Error("Failed to create guest session");
  }

  const data = await response.json();
  setGuestSession(data.guestToken, data.userId);

  return { token: data.guestToken, userId: data.userId };
}

export async function refreshGuestSession(): Promise<GuestSession | null> {
  const token = getGuestToken();
  if (!token) return null;

  const validation = await validateGuestToken(token);
  if (!validation.valid || !validation.userId) {
    clearGuestSession();
    return null;
  }

  return { token, userId: validation.userId };
}
