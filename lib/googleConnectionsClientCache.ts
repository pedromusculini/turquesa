import type { GoogleConnectionsResponse } from '@/lib/useGoogleConnectionHealth';

const TTL_MS = 90_000;

type CacheEntry = {
  data: GoogleConnectionsResponse;
  at: number;
};

let memory: CacheEntry | null = null;
let inflight: Promise<GoogleConnectionsResponse> | null = null;

export function peekGoogleConnectionsCache(): GoogleConnectionsResponse | null {
  if (!memory) return null;
  if (Date.now() - memory.at > TTL_MS) return null;
  return memory.data;
}

export function setGoogleConnectionsCache(data: GoogleConnectionsResponse): void {
  memory = { data, at: Date.now() };
}

export function clearGoogleConnectionsCache(): void {
  memory = null;
  inflight = null;
}

/** Fetch com cache curto + dedupe de requests paralelos. */
export async function fetchGoogleConnections(opts?: {
  light?: boolean;
  force?: boolean;
}): Promise<GoogleConnectionsResponse> {
  if (!opts?.force) {
    const cached = peekGoogleConnectionsCache();
    if (cached) return cached;
    if (inflight) return inflight;
  }

  const qs = opts?.light ? '?light=1' : '';
  const run = (async () => {
    const res = await fetch(`/api/auth/google-connections${qs}`);
    const json = (await res.json()) as GoogleConnectionsResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || 'Não foi possível verificar o Google');
    }
    const data: GoogleConnectionsResponse = {
      connected: !!json.connected,
      drive: !!json.drive,
      calendar: !!json.calendar,
      contacts: !!json.contacts,
      needsConnect: !!json.needsConnect,
      needsReconnect: !!json.needsReconnect,
      healthy: json.healthy,
      summary: json.summary,
      driveHealthy: json.driveHealthy,
      calendarHealthy: json.calendarHealthy,
    };
    setGoogleConnectionsCache(data);
    return data;
  })();

  inflight = run.finally(() => {
    inflight = null;
  });
  return inflight;
}
