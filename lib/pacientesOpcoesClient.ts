/**
 * Cache client-side compartilhado para /api/clientes/pacientes-opcoes.
 * Evita refetch em cada mount de PacienteSearchField na mesma sessão.
 */

import type { PacienteOpcao } from '@/lib/types';

export type PacientesOpcoesPayload = {
  opcoes: PacienteOpcao[];
  google_contatos_disponivel: boolean;
  drive_conectado: boolean;
  aviso: string | null;
};

/** TTL do cache no browser (minutos). */
export const PACIENTES_OPCOES_CLIENT_TTL_MS = 5 * 60 * 1000;

let inflight: Promise<PacientesOpcoesPayload> | null = null;
let cached: { data: PacientesOpcoesPayload; at: number } | null = null;

export function invalidatePacientesOpcoesClientCache(): void {
  inflight = null;
  cached = null;
}

export async function fetchPacientesOpcoes(options?: {
  force?: boolean;
}): Promise<PacientesOpcoesPayload> {
  const now = Date.now();
  if (
    !options?.force &&
    cached &&
    now - cached.at < PACIENTES_OPCOES_CLIENT_TTL_MS
  ) {
    return cached.data;
  }

  if (!options?.force && inflight) {
    return inflight;
  }

  inflight = fetch('/api/clientes/pacientes-opcoes')
    .then(async (res) => {
      const data = (await res.json()) as PacientesOpcoesPayload & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível carregar a lista de clientes.');
      }
      const payload: PacientesOpcoesPayload = {
        opcoes: data.opcoes ?? [],
        google_contatos_disponivel: !!data.google_contatos_disponivel,
        drive_conectado: data.drive_conectado !== false,
        aviso: data.aviso ?? null,
      };
      cached = { data: payload, at: Date.now() };
      return payload;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
