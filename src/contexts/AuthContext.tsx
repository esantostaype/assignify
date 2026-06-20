// src/contexts/AuthContext.tsx
// Adaptador fino sobre Auth.js: mantiene la API `useAuth()` que ya usan Header y
// ProtectedRoute (user/loading/isAuthenticated/logout), pero respaldada por la
// sesión real de Auth.js (useSession + signOut). La protección de rutas la hace el
// middleware en el servidor; esto es solo para la UI.
'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';

interface AuthUser {
  email: string;
  name?: string;
  image?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export function useAuth(): AuthContextType {
  const { data: session, status } = useSession();
  const email = session?.user?.email;

  return {
    user: email
      ? {
          email,
          name: session?.user?.name ?? undefined,
          image: session?.user?.image ?? undefined,
          role: session?.user?.role,
        }
      : null,
    loading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    logout: async () => {
      await signOut({ callbackUrl: '/login' });
    },
  };
}

// Passthrough por compatibilidad: el <SessionProvider> ahora vive en providers.tsx.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
