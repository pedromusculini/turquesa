'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import AppShell from '@/components/AppShell';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import MetaPixel from '@/components/MetaPixel';
import LegalReacceptModal from '@/components/LegalReacceptModal';
import ReportarBugButton from '@/components/ReportarBugButton';
import { ToastProvider } from '@/components/ToastProvider';
import { ConfirmProvider } from '@/components/ConfirmProvider';

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session ?? undefined}>
      <ToastProvider>
        <ConfirmProvider>
          <AppShell>{children}</AppShell>
          <ReportarBugButton />
          <CookieConsentBanner />
          <MetaPixel />
          <LegalReacceptModal />
        </ConfirmProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
