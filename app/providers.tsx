'use client';

import { SessionProvider } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import CookieConsentBanner from '@/components/CookieConsentBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
      <CookieConsentBanner />
    </SessionProvider>
  );
}
