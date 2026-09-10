'use client';

import { useEffect, useState } from 'react';

/** Monta filhos pesados após idle (ou timeout), para não competir com o primeiro paint. */
export function useDeferredMount(timeoutMs = 1200): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (!cancelled) setReady(true);
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(go, { timeout: timeoutMs });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }

    const id = window.setTimeout(go, Math.min(timeoutMs, 800));
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [timeoutMs]);

  return ready;
}
