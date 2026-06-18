// src/app/providers.tsx
"use client";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { RealtimeListener } from "@/components/RealtimeListener";
import { QueryProvider } from "@/providers/QueryProvider";
import { UiThemeProvider } from "@/providers/UiThemeProvider";
import { HotToaster } from "@/lib/hotToast";

// El listener de tiempo real (Pusher) no hace falta en la pantalla de login.
function ConditionalRealtime() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <RealtimeListener />;
}

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider>
      <UiThemeProvider>
        <QueryProvider>
          <ConditionalRealtime />
          {children}
          <HotToaster />
        </QueryProvider>
      </UiThemeProvider>
    </SessionProvider>
  );
};
