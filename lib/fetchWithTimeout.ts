export const GOOGLE_FETCH_TIMEOUT_MS = 30_000;

export class FetchTimeoutError extends Error {
  constructor(message = 'Tempo esgotado. Verifique a conexão e tente novamente.') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

/** fetch com AbortController — evita spinner infinito em rede lenta (PWA/mobile). */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = GOOGLE_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const externalSignal = init?.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FetchTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isFetchTimeoutError(err: unknown): boolean {
  return err instanceof FetchTimeoutError;
}

/** Mensagem amigável para falhas de rede no mobile/desktop. */
export function formatAgendaFetchError(
  err: unknown,
  timeoutMs?: number,
): string {
  if (isFetchTimeoutError(err)) {
    const sec = timeoutMs != null ? Math.round(timeoutMs / 1000) : 30;
    return `A operação demorou mais de ${sec} segundos. Tente de novo com Wi‑Fi estável.`;
  }
  const msg = err instanceof Error ? err.message : '';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Conexão interrompida. Verifique a rede e tente de novo.';
  }
  return msg.trim() || 'Não foi possível concluir. Tente novamente.';
}
