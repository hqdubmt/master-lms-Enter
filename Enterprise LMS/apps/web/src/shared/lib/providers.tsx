"use client";

import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { useAuthStore } from "../store/auth.store";

function AuthHydration() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // Sync token from localStorage to store on mount
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    const stored = useAuthStore.getState();
    if (token && stored.user && !stored.isAuthenticated) {
      setAuth(stored.user, token);
    }
  }, [setAuth]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => queryClient);

  return (
    <QueryClientProvider client={client}>
      <AuthHydration />
      {children}
    </QueryClientProvider>
  );
}
