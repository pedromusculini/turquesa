'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomSession } from '@/lib/useSession';
import {
  PRIMEIROS_PASSOS_STEPS,
  TOUR_STORAGE_KEY,
  tourRouteMatches,
} from '@/lib/primeirosPassosTour';

type TourPrefs = {
  tour_completed_at: string | null;
  hints_dismissed: string[];
};

type PrimeirosPassosTourContextValue = {
  tourActive: boolean;
  tourStepIndex: number;
  tourCompleted: boolean;
  hintsDismissed: string[];
  startTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  dismissHint: (hintId: string) => void;
  isHintDismissed: (hintId: string) => boolean;
  prefsLoaded: boolean;
};

const PrimeirosPassosTourContext = createContext<PrimeirosPassosTourContextValue | null>(null);

function readLocalPrefs(email: string): TourPrefs | null {
  try {
    const raw = localStorage.getItem(`${TOUR_STORAGE_KEY}:${email}`);
    if (!raw) return null;
    return JSON.parse(raw) as TourPrefs;
  } catch {
    return null;
  }
}

function writeLocalPrefs(email: string, prefs: TourPrefs) {
  try {
    localStorage.setItem(`${TOUR_STORAGE_KEY}:${email}`, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

export function PrimeirosPassosTourProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useCustomSession();
  const pathname = usePathname();
  const router = useRouter();
  const email = session?.user?.email?.toLowerCase().trim() ?? '';

  const hasIniciarTourParam = () => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('iniciar-tour') === '1';
  };

  const [prefs, setPrefs] = useState<TourPrefs>({
    tour_completed_at: null,
    hints_dismissed: [],
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const autoStarted = useRef(false);

  const isAuthenticated = status === 'authenticated' && !!email;

  useEffect(() => {
    if (!isAuthenticated) {
      setPrefsLoaded(false);
      return;
    }

    const local = readLocalPrefs(email);
    if (local) setPrefs(local);

    fetch('/api/perfil/tour')
      .then((r) => r.json())
      .then((data: TourPrefs) => {
        if (data && typeof data === 'object' && !('error' in data)) {
          setPrefs(data);
          writeLocalPrefs(email, data);
        }
      })
      .catch(() => {
        /* mantém local */
      })
      .finally(() => setPrefsLoaded(true));
  }, [isAuthenticated, email]);

  const markComplete = useCallback(async () => {
    const now = new Date().toISOString();
    const next: TourPrefs = { ...prefs, tour_completed_at: now };
    setPrefs(next);
    writeLocalPrefs(email, next);
    setTourActive(false);
    setTourStepIndex(0);

    try {
      await fetch('/api/perfil/tour', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
    } catch {
      /* local já salvo */
    }
  }, [email, prefs]);

  const startTourInternal = useCallback(() => {
    setTourStepIndex(0);
    setTourActive(true);
  }, []);

  const startTour = useCallback(() => {
    if (pathname !== '/dashboard') {
      router.push('/dashboard?iniciar-tour=1');
      return;
    }
    startTourInternal();
  }, [pathname, router, startTourInternal]);

  const skipTour = useCallback(() => {
    void markComplete();
  }, [markComplete]);

  useEffect(() => {
    if (!tourActive) return;
    const step = PRIMEIROS_PASSOS_STEPS[tourStepIndex];
    if (!step?.route) return;

    const search =
      typeof window !== 'undefined' ? window.location.search : '';
    if (tourRouteMatches(step.route, pathname, search)) return;

    router.push(step.route);
  }, [tourActive, tourStepIndex, pathname, router]);

  const nextStep = useCallback(() => {
    const last = PRIMEIROS_PASSOS_STEPS.length - 1;
    if (tourStepIndex >= last) {
      void markComplete();
      return;
    }
    setTourStepIndex((i) => i + 1);
  }, [markComplete, tourStepIndex]);

  const prevStep = useCallback(() => {
    setTourStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const dismissHint = useCallback(
    async (hintId: string) => {
      if (prefs.hints_dismissed.includes(hintId)) return;
      const next: TourPrefs = {
        ...prefs,
        hints_dismissed: [...prefs.hints_dismissed, hintId],
      };
      setPrefs(next);
      writeLocalPrefs(email, next);

      try {
        await fetch('/api/perfil/tour', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismiss_hint', hintId }),
        });
      } catch {
        /* local já salvo */
      }
    },
    [email, prefs],
  );

  const isHintDismissed = useCallback(
    (hintId: string) => prefs.hints_dismissed.includes(hintId),
    [prefs.hints_dismissed],
  );

  useEffect(() => {
    if (!isAuthenticated || pathname !== '/dashboard') return;
    if (!hasIniciarTourParam()) return;

    const params = new URLSearchParams(window.location.search);
    params.delete('iniciar-tour');
    const qs = params.toString();
    router.replace(`/dashboard${qs ? `?${qs}` : ''}`);

    const timer = window.setTimeout(() => startTourInternal(), 400);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, pathname, router, startTourInternal]);

  useEffect(() => {
    if (!isAuthenticated || !prefsLoaded || autoStarted.current) return;
    if (pathname !== '/dashboard') return;
    if (prefs.tour_completed_at) return;
    if (hasIniciarTourParam()) return;

    autoStarted.current = true;
    const timer = window.setTimeout(() => startTourInternal(), 800);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, pathname, prefs.tour_completed_at, prefsLoaded, startTourInternal]);

  const value = useMemo<PrimeirosPassosTourContextValue>(
    () => ({
      tourActive,
      tourStepIndex,
      tourCompleted: !!prefs.tour_completed_at,
      hintsDismissed: prefs.hints_dismissed,
      startTour,
      skipTour,
      nextStep,
      prevStep,
      dismissHint,
      isHintDismissed,
      prefsLoaded,
    }),
    [
      tourActive,
      tourStepIndex,
      prefs.tour_completed_at,
      prefs.hints_dismissed,
      startTour,
      skipTour,
      nextStep,
      prevStep,
      dismissHint,
      isHintDismissed,
      prefsLoaded,
    ],
  );

  return (
    <PrimeirosPassosTourContext.Provider value={value}>{children}</PrimeirosPassosTourContext.Provider>
  );
}

export function usePrimeirosPassosTour() {
  const ctx = useContext(PrimeirosPassosTourContext);
  if (!ctx) {
    throw new Error('usePrimeirosPassosTour deve ser usado dentro de PrimeirosPassosTourProvider');
  }
  return ctx;
}
