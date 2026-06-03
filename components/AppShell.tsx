'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import AppFooter from '@/components/AppFooter';
import { ADMIN_PANEL_PATH } from '@/lib/constants';

const MINIMAL_CHROME_PREFIXES = [
  '/auth/verificar-email',
  '/login',
  '/privacidade',
  '/termos',
  '/f/',
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isInternalOps =
    pathname === ADMIN_PANEL_PATH || pathname.startsWith(`${ADMIN_PANEL_PATH}/`);
  const minimalChrome =
    isInternalOps ||
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
    <>
      <Header />
      <main className="min-h-[calc(100dvh-8.5rem)] md:min-h-[calc(100vh-85px)] min-w-0 overflow-x-hidden">
        {children}
      </main>
      <AppFooter />
    </>
  );
}
