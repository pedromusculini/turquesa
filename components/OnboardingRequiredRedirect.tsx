'use client';

import { useEffect, useRef } from 'react';
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
  '/s/',
  '/convite/',
  '/calendario/adicionar/',
  '/r/',
  '/naomexaaquiseucorno',
  '/',
];

const CACHE_KEY = 'turquesa_onboarding_ok_v1';

function shouldSkip(pathname: string): boolean {
  if (pathname === '/') return true;
  return SKIP_PREFIXES.some((p) => {
    if (p === '/') return pathname === '/';
    return pathname === p || pathname.startsWith(p);
  });
}

function readCachedOk(email: string | undefined): boolean {
  if (!email || typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { email?: string; ok?: boolean };
    return parsed.email === email.toLowerCase() && parsed.ok === true;
  } catch {
    return false;
  }
}

function writeCachedOk(email: string) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ email: email.toLowerCase(), ok: true }),
    );
  } catch {
    /* ignore */
  }
}

/** Redireciona client-side se o titular ainda não concluiu o onboarding. */
export default function OnboardingRequiredRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || shouldSkip(pathname)) return;

    const email = session?.user?.email ?? undefined;
    if (readCachedOk(email) || checkedRef.current) return;

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
        if (data.onboardingCompleted || data.equipeProfissional) {
          checkedRef.current = true;
          if (email) writeCachedOk(email);
          return;
        }
        const dest = `/onboarding?callbackUrl=${encodeURIComponent(pathname)}`;
        router.replace(dest);
      } catch {
        /* middleware cobre na próxima navegação */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, pathname, router, session?.user?.email]);

  return null;
}
