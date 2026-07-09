'use client';

import { useCallback, useEffect, useState } from 'react';

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

export function useGoogleConnectionHealth() {
  const [data, setData] = useState<GoogleConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google-connections');
      const json = (await res.json()) as GoogleConnectionsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível verificar o Google');
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao verificar Google');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const showAlert =
    !!data &&
    (data.needsConnect || data.needsReconnect || data.healthy === false);

  return { data, loading, error, reload, showAlert };
}

export function googleAuthorizeUrl(redirectPath: string): string {
  const redirect = encodeURIComponent(redirectPath);
  return `/api/auth/google-authorize?scope=all&redirect=${redirect}`;
}
