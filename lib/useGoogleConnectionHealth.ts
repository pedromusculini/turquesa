'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchGoogleConnections,
  peekGoogleConnectionsCache,
} from '@/lib/googleConnectionsClientCache';

export type GoogleConnectionsResponse = {
  connected: boolean;
  drive: boolean;
  calendar: boolean;
  contacts: boolean;
  needsConnect: boolean;
  needsReconnect?: boolean;
  healthy?: boolean;
  summary?: string;
  driveHealthy?: boolean;
  calendarHealthy?: boolean;
};

export function useGoogleConnectionHealth(opts?: { lightFirst?: boolean }) {
  const lightFirst = opts?.lightFirst ?? false;
  const [data, setData] = useState<GoogleConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (force = false) => {
      if (!peekGoogleConnectionsCache()) setLoading(true);
      setError(null);
      try {
        // Gate da agenda: DB-only primeiro; health live em background.
        const json = await fetchGoogleConnections({
          light: lightFirst && !force,
          force,
        });
        setData(json);
        if (lightFirst && !force) {
          void fetchGoogleConnections({ force: true })
            .then(setData)
            .catch(() => undefined);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao verificar Google');
        if (!peekGoogleConnectionsCache()) setData(null);
      } finally {
        setLoading(false);
      }
    },
    [lightFirst],
  );

  useEffect(() => {
    const cached = peekGoogleConnectionsCache();
    if (cached) {
      setData(cached);
      setLoading(false);
    }
    void reload(false);
  }, [reload]);

  const showAlert =
    !!data &&
    (data.needsConnect || data.needsReconnect || data.healthy === false);

  return { data, loading, error, reload: () => reload(true), showAlert };
}

export function googleAuthorizeUrl(redirectPath: string): string {
  const redirect = encodeURIComponent(redirectPath);
  return `/api/auth/google-authorize?scope=all&redirect=${redirect}`;
}
