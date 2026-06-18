/**
 * Cache client-side compartilhado para /api/clientes/pacientes-opcoes.
 * Evita refetch em cada mount de PacienteSearchField na mesma sessão.
 */

import type { PacienteOpcao } from '@/lib/types';

export type PacientesOpcoesPayload = {
  opcoes: PacienteOpcao[];
  total?: number;
  google_contatos_disponivel: boolean;
  drive_conectado: boolean;
  aviso: string | null;
};

export type GoogleContatosPayload = {
  contatos: PacienteOpcao[];
  aviso: string | null;
  google_contatos_disponivel: boolean;
};

/** TTL do cache no browser (minutos). */
export const PACIENTES_OPCOES_CLIENT_TTL_MS = 5 * 60 * 1000;

type CacheKey = string;

let inflight = new Map<CacheKey, Promise<PacientesOpcoesPayload>>();
let cached = new Map<CacheKey, { data: PacientesOpcoesPayload; at: number }>();

function opcoesCacheKey(options?: {
  q?: string;
  includeGoogle?: boolean;
  limit?: number;
}): CacheKey {
  const q = options?.q?.trim() ?? '';
  const ig = options?.includeGoogle ? '1' : '0';
  const lim = options?.limit ?? '';
  return `${ig}:${lim}:${q}`;
}

export function invalidatePacientesOpcoesClientCache(): void {
  inflight.clear();
  cached.clear();
}

export async function fetchPacientesOpcoes(options?: {
  force?: boolean;
  q?: string;
  includeGoogle?: boolean;
  limit?: number;
}): Promise<PacientesOpcoesPayload> {
  const key = opcoesCacheKey(options);
  const now = Date.now();
  const includeGoogle = options?.includeGoogle === true;

  if (
    !options?.force &&
    cached.has(key) &&
    now - (cached.get(key)?.at ?? 0) < PACIENTES_OPCOES_CLIENT_TTL_MS
  ) {
    return cached.get(key)!.data;
  }

  if (!options?.force && inflight.has(key)) {
    return inflight.get(key)!;
  }

  const params = new URLSearchParams();
  if (options?.q?.trim()) params.set('q', options.q.trim());
  params.set('includeGoogle', includeGoogle ? '1' : '0');
  if (options?.limit) params.set('limit', String(options.limit));

  const promise = fetch(`/api/clientes/pacientes-opcoes?${params.toString()}`)
    .then(async (res) => {
      const data = (await res.json()) as PacientesOpcoesPayload & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível carregar a lista de clientes.');
      }
      const payload: PacientesOpcoesPayload = {
        opcoes: data.opcoes ?? [],
        total: typeof data.total === 'number' ? data.total : undefined,
        google_contatos_disponivel: !!data.google_contatos_disponivel,
        drive_conectado: data.drive_conectado !== false,
        aviso: data.aviso ?? null,
      };
      cached.set(key, { data: payload, at: Date.now() });
      return payload;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export async function fetchGoogleContatos(options: {
  q: string;
  limit?: number;
}): Promise<GoogleContatosPayload> {
  const q = options.q.trim();
  if (q.length < 2) {
    return { contatos: [], aviso: null, google_contatos_disponivel: false };
  }

  const params = new URLSearchParams({ q });
  if (options.limit) params.set('limit', String(options.limit));

  const res = await fetch(`/api/clientes/google-contatos?${params.toString()}`);
  const data = (await res.json()) as GoogleContatosPayload & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível buscar Contatos Google.');
  }
  return {
    contatos: data.contatos ?? [],
    aviso: data.aviso ?? null,
    google_contatos_disponivel: !!data.google_contatos_disponivel,
  };
}

export async function warmGoogleContactsCache(): Promise<void> {
  await fetch('/api/clientes/warm-google-contacts', { method: 'POST' });
}
