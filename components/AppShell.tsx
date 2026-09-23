'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import AppFooter from '@/components/AppFooter';
import PrimeirosPassosTour from '@/components/PrimeirosPassosTour';
import { PrimeirosPassosTourProvider } from '@/lib/PrimeirosPassosTourContext';
import { ADMIN_PANEL_PATH } from '@/lib/constants';
import OnboardingRequiredRedirect from '@/components/OnboardingRequiredRedirect';
import { forceUnlockBodyScroll } from '@/lib/useBodyScrollLock';

const MINIMAL_CHROME_PREFIXES = [
  '/auth/verificar-email',
  '/login',
  '/onboarding',
  '/renovar',
  '/instalar',
  '/app',
  '/privacidade',
  '/termos',
  '/convite/',
  '/agendar/',
  '/s/',
  '/f/',
  '/c/',
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Rede de segurança mobile/PWA: se um modal desmontou sem liberar o lock,
  // a troca de menu (rota) restaura scroll e toques.
  useEffect(() => {
    forceUnlockBodyScroll();
  }, [pathname]);

  const isInternalOps =
    pathname === ADMIN_PANEL_PATH || pathname.startsWith(`${ADMIN_PANEL_PATH}/`);
  /** Landing de conversão (/) sem Header/Footer do app — evita nav competindo com CTA. */
  const isConversionLanding = pathname === '/';
  const minimalChrome =
    isInternalOps ||
    isConversionLanding ||
    MINIMAL_CHROME_PREFIXES.some((p) =>
      p.endsWith('/')
        ? pathname.startsWith(p)
        : pathname === p || pathname.startsWith(`${p}/`),
    );

  if (minimalChrome) {
    return (
      <main className={isInternalOps ? 'min-h-screen internal-ops-root' : 'min-h-screen'}>
        {children}
      </main>
    );
  }

  return (
    <PrimeirosPassosTourProvider>
      <OnboardingRequiredRedirect />
      <Header />
      <main className="min-h-[calc(100dvh-4.5rem)] min-w-0 overflow-x-hidden pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:min-h-[calc(100vh-85px)] md:pb-0">
        {children}
      </main>
      <AppFooter />
      <PrimeirosPassosTour />
    </PrimeirosPassosTourProvider>
  );
}
