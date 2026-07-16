/** Gatilhos de cliente para o worker do outbox Google (retry quase em tempo real). */

const PROCESS_URL = '/api/consultas/google-outbox/process';
const RETRY_URL = '/api/consultas/google-outbox/retry';

let lastTrigger = 0;

/**
 * Dispara o processamento da fila do dono (fire-and-forget), com throttle para
 * não sobrecarregar a serverless em abas múltiplas.
 */
export function triggerGoogleOutboxProcessing(minGapMs = 20_000): void {
  if (typeof window === 'undefined') return;
  if (document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (now - lastTrigger < minGapMs) return;
  lastTrigger = now;
  fetch(PROCESS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    keepalive: true,
  }).catch(() => {});
}

/** Reenvia itens em erro (opcionalmente de uma sessão) e reprocessa. */
export async function retryGoogleOutboxOnServer(
  consultaId?: string,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch(RETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultaId ? { consultaId } : {}),
    });
    return res.ok;
  } catch {
    return false;
  }
}
