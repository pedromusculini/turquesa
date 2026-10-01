'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
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

function readCacheRaw(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY) ?? sessionStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

const subscribeNoop = () => () => {};

function cachedOkFor(raw: string | null, email: string | undefined): boolean {
  if (!raw || !email) return false;
  try {
    const parsed = JSON.parse(raw) as { email?: string; ok?: boolean };
    return parsed.email === email.toLowerCase() && parsed.ok === true;
  } catch {
    return false;
  }
}

function writeCachedOk(email: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ email: email.toLowerCase(), ok: true }));
  } catch {
    /* ignore */
  }
}

/**
 * `checking` enquanto não se sabe se o titular concluiu o onboarding: o AppShell não
 * renderiza menu/telas do app nesse intervalo (evita a pessoa navegar e ser devolvida
 * ao onboarding a cada toque). Concluído ou erro de rede → `ok`.
 */
export function useOnboardingGate(enabled: boolean): 'ok' | 'checking' {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? undefined;
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  const cacheRaw = useSyncExternalStore(subscribeNoop, readCacheRaw, () => undefined);
  const hydrated = cacheRaw !== undefined;

  const active = enabled && !shouldSkip(pathname);
  const cachedOk = hydrated && cachedOkFor(cacheRaw, email);
  const verified = !!email && verifiedEmail === email;

  useEffect(() => {
    if (!active || !hydrated || status !== 'authenticated' || !email || cachedOk || verified) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/onboarding/status', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          setVerifiedEmail(email);
          return;
        }
        const data = (await res.json()) as {
          onboardingCompleted?: boolean;
          equipeProfissional?: unknown;
        };
        if (cancelled) return;
        if (data.onboardingCompleted || data.equipeProfissional) {
          writeCachedOk(email);
          setVerifiedEmail(email);
          return;
        }
        router.replace(`/onboarding?callbackUrl=${encodeURIComponent(pathname)}`);
      } catch {
        if (!cancelled) setVerifiedEmail(email);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, hydrated, status, email, cachedOk, verified, pathname, router]);

  if (!active || status === 'unauthenticated') return 'ok';
  if (status === 'loading') return 'checking';
  return cachedOk || verified ? 'ok' : 'checking';
}
