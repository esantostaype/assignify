// src/app/providers.tsx
"use client";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { RealtimeListener } from "@/components/RealtimeListener";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { QueryProvider } from "@/providers/QueryProvider";
import { UiThemeProvider } from "@/providers/UiThemeProvider";
import { HotToaster } from "@/lib/hotToast";

// El listener de tiempo real (Pusher) no hace falta en la pantalla de login.
function ConditionalRealtime() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <RealtimeListener />;
}

// Wizard de onboarding: tampoco en login. El propio wizard decide si mostrarse
// (workspace sin configurar y no marcado como onboarded).
function ConditionalOnboardingWizard() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <OnboardingWizard />;
}

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider>
      <UiThemeProvider>
        <QueryProvider>
          <ConditionalRealtime />
          <ConditionalOnboardingWizard />
          {children}
          <HotToaster />
        </QueryProvider>
      </UiThemeProvider>
    </SessionProvider>
  );
};
