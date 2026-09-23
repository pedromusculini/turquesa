'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import ConfiguracoesSubNav from '@/components/ConfiguracoesSubNav';
import AppBootSplash from '@/components/AppBootSplash';
import { findSettingsItem, isConfiguracoesHub, resolveConfiguracoesTab } from '@/lib/nav';

function SubNavFallback() {
  return <div className="mb-6 hidden h-40 animate-pulse rounded-xl bg-gray-100 lg:block" />;
}

function ConfiguracoesChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const hub = isConfiguracoesHub(pathname, tabParam);
  const active = resolveConfiguracoesTab(pathname, tabParam);
  const current = findSettingsItem(active);

  return (
    <div className="min-h-screen bg-[var(--brand-bg-page)]">
      <div className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <Link
          href={hub ? '/dashboard' : '/dashboard/configuracoes'}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--brand-primary)]"
        >
          <ChevronLeft className="h-4 w-4" />
          {hub ? 'Início' : 'Configurações'}
        </Link>
        {!hub && current ? (
          <p className="mt-1 text-base font-semibold text-[var(--app-text)] lg:hidden">
            {current.label}
          </p>
        ) : null}
      </div>
      <div className="mx-auto lg:grid lg:max-w-5xl lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:px-4 lg:pt-4">
        <Suspense fallback={<SubNavFallback />}>
          <ConfiguracoesSubNav />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (!mounted || status === 'loading') {
    return <AppBootSplash label="Abrindo configurações…" />;
  }

  return (
    <Suspense fallback={<AppBootSplash label="Abrindo configurações…" />}>
      <ConfiguracoesChrome>{children}</ConfiguracoesChrome>
    </Suspense>
  );
}
