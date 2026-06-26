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
