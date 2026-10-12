'use client';

import type { AtivacaoResumo } from '@/lib/ativacaoSalao';

export type AtivacaoResponse = {
  resumo: AtivacaoResumo;
  subscription: {
    status: string;
    trial_ends_at: string | null;
    daysLeftTrial: number | null;
    first_payment_at: string | null;
  };
};

const TTL_MS = 60_000;
const STORAGE_KEY = 'turquesa:ativacao:v1';
let cached: { at: number; promise: Promise<AtivacaoResponse | null> } | null = null;

/** Última resposta salva no aparelho: os cards do painel abrem já no estado certo, sem pular. */
export function readAtivacaoCache(): AtivacaoResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AtivacaoResponse) : null;
  } catch {
    return null;
  }
}

/** Uma requisição compartilhada entre checklist e resumo do trial no mesmo painel. */
export function fetchAtivacao(options?: { force?: boolean }): Promise<AtivacaoResponse | null> {
  if (!options?.force && cached && Date.now() - cached.at < TTL_MS) return cached.promise;
  const promise = fetch('/api/conta/ativacao', { credentials: 'include' })
    .then((r) => (r.ok ? (r.json() as Promise<AtivacaoResponse>) : null))
    .then((data) => {
      if (data) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
          /* ignore quota */
        }
      }
      return data;
    })
    .catch(() => null);
  cached = { at: Date.now(), promise };
  return promise;
}
