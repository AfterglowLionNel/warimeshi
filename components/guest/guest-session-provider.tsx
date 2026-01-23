"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  GuestSession,
  getGuestToken,
  getGuestUserId,
  setGuestSession,
  clearGuestSession,
  validateGuestToken,
} from "@/lib/guest/guest-session";

interface GuestSessionContextType {
  guestSession: GuestSession | null;
  isLoading: boolean;
  createGuestSession: (displayName?: string) => Promise<GuestSession>;
  clearSession: () => void;
  refreshSession: () => Promise<void>;
}

const GuestSessionContext = createContext<GuestSessionContextType | null>(null);

export function useGuestSession() {
  const context = useContext(GuestSessionContext);
  if (!context) {
    throw new Error("useGuestSession must be used within a GuestSessionProvider");
  }
  return context;
}

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const [guestSession, setGuestSessionState] = useState<GuestSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const token = getGuestToken();
    const userId = getGuestUserId();

    if (!token || !userId) {
      setGuestSessionState(null);
      setIsLoading(false);
      return;
    }

    try {
      const validation = await validateGuestToken(token);
      if (validation.valid && validation.userId) {
        setGuestSessionState({ token, userId: validation.userId });
      } else {
        clearGuestSession();
        setGuestSessionState(null);
      }
    } catch {
      setGuestSessionState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const createGuestSession = async (displayName?: string): Promise<GuestSession> => {
    const response = await fetch("/api/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      throw new Error("Failed to create guest session");
    }

    const data = await response.json();
    const session: GuestSession = { token: data.guestToken, userId: data.userId };
    setGuestSession(session.token, session.userId);
    setGuestSessionState(session);

    return session;
  };

  const clearSession = () => {
    clearGuestSession();
    setGuestSessionState(null);
  };

  return (
    <GuestSessionContext.Provider
      value={{
        guestSession,
        isLoading,
        createGuestSession,
        clearSession,
        refreshSession,
      }}
    >
      {children}
    </GuestSessionContext.Provider>
  );
}
