'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const SKIP_PREFIXES = [
  '/onboarding',
  '/login',
  '/auth/',
  '/register',
  '/renovar',
  '/instalar',
  '/app',
  '/privacidade',
  '/termos',
  '/planos',
  '/f/',
  '/c/',
  '/agendar/',
  '/convite/',
  '/calendario/adicionar/',
  '/r/',
  '/naomexaaquiseucorno',
  '/',
];

function shouldSkip(pathname: string): boolean {
  if (pathname === '/') return true;
  return SKIP_PREFIXES.some((p) => {
    if (p === '/') return pathname === '/';
    return pathname === p || pathname.startsWith(p);
  });
}

/** Redireciona client-side se o titular ainda não concluiu o onboarding. */
export default function OnboardingRequiredRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || shouldSkip(pathname)) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/onboarding/status', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          onboardingCompleted?: boolean;
          equipeProfissional?: unknown;
        };
        if (cancelled) return;
        if (data.onboardingCompleted || data.equipeProfissional) return;
        const dest = `/onboarding?callbackUrl=${encodeURIComponent(pathname)}`;
        router.replace(dest);
      } catch {
        /* middleware cobre na próxima navegação */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, pathname, router]);

  return null;
}
