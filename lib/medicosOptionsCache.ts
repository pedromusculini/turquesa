/** Cache curto em memória da lista de profissionais (troca de menu). */

import {
  loadMedicosOptions as fetchMedicosOptions,
  type MedicosOptionsResult,
} from '@/lib/loadMedicosOptions';

const TTL_MS = 60_000;

let memory: { at: number; data: MedicosOptionsResult } | null = null;
let inflight: Promise<MedicosOptionsResult> | null = null;

export function peekMedicosOptionsCache(): MedicosOptionsResult | null {
  if (!memory) return null;
  if (Date.now() - memory.at > TTL_MS) return null;
  return memory.data;
}

export function clearMedicosOptionsCache(): void {
  memory = null;
  inflight = null;
}

export async function loadMedicosOptionsCached(opts?: {
  force?: boolean;
}): Promise<MedicosOptionsResult> {
  if (!opts?.force) {
    const cached = peekMedicosOptionsCache();
    if (cached) return cached;
    if (inflight) return inflight;
  }

  const run = fetchMedicosOptions()
    .then((data) => {
      memory = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  inflight = run;
  return run;
}
