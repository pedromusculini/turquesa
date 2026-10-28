import type { OnboardingEtapa } from '@/lib/onboardingEtapas';

/** Registra a etapa do primeiro uso no servidor; uma vez por aparelho e etapa, sem esperar. */
export function registrarEtapaOnboarding(etapa: OnboardingEtapa): void {
  if (typeof window === 'undefined') return;
  const key = `turquesa:etapa:${etapa}`;
  try {
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* modo privado: manda mesmo assim, o servidor ignora repetição */
  }
  void fetch('/api/onboarding/etapa', {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapa }),
  }).catch(() => {
    /* medição nunca atrapalha o uso */
  });
}
