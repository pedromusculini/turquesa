/**
 * Último estado conhecido guardado no aparelho (localStorage), por dono.
 * Serve para a tela abrir na hora e revalidar em segundo plano.
 */

const PREFIX = 'ta:snap:';
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

type Envelope<T> = { owner: string; at: number; data: T };

function normOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

export function readDeviceSnapshot<T>(name: string, owner: string | null | undefined): T | null {
  if (!owner || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + name);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (env.owner !== normOwner(owner)) return null;
    if (Date.now() - env.at > MAX_AGE_MS) return null;
    return env.data;
  } catch {
    return null;
  }
}

export function writeDeviceSnapshot<T>(
  name: string,
  owner: string | null | undefined,
  data: T,
): void {
  if (!owner || typeof window === 'undefined') return;
  try {
    const env: Envelope<T> = { owner: normOwner(owner), at: Date.now(), data };
    window.localStorage.setItem(PREFIX + name, JSON.stringify(env));
  } catch {
    /* quota / modo privado */
  }
}
