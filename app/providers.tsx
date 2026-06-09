'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import AppShell from '@/components/AppShell';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import ReportarBugButton from '@/components/ReportarBugButton';

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session ?? undefined}>
      <AppShell>{children}</AppShell>
      <ReportarBugButton />
      <CookieConsentBanner />
    </SessionProvider>
  );
}
