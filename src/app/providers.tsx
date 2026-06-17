/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/providers.tsx - MEJORADO
"use client";
import { RealtimeListener } from "@/components/RealtimeListener";
import { QueryProvider } from "@/providers/QueryProvider";
import { UiThemeProvider } from "@/providers/UiThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";

// Wrapper condicional para AuthProvider
function ConditionalAuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Rutas que NO necesitan AuthProvider
  const publicRoutes = ['/login'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;
  
  if (isPublicRoute) {
    console.log(`🔓 Public route: ${pathname} - Skipping AuthProvider`);
    return <>{children}</>;
  }
  
  console.log(`🔒 Protected route: ${pathname} - Using AuthProvider`);
  return (
    <AuthProvider>
      <RealtimeListener />
      {children}
    </AuthProvider>
  );
}

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <UiThemeProvider>
      <QueryProvider>
        <ConditionalAuthWrapper>
          {children}
          <Toaster position="top-right" />
        </ConditionalAuthWrapper>
      </QueryProvider>
    </UiThemeProvider>
  );
};