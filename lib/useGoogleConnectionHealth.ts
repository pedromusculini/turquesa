'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchGoogleConnections,
  peekGoogleConnectionsCache,
} from '@/lib/googleConnectionsClientCache';
import { readDeviceSnapshot, writeDeviceSnapshot } from '@/lib/deviceSnapshot';

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

const SNAPSHOT = 'google-connections';

/** `ownerEmail` liga o último estado salvo no aparelho (abre sem esperar a rede). */
export function useGoogleConnectionHealth(opts?: {
  lightFirst?: boolean;
  ownerEmail?: string | null;
}) {
  const lightFirst = opts?.lightFirst ?? false;
  const ownerEmail = opts?.ownerEmail ?? null;
  const [data, setData] = useState<GoogleConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  const applyData = useCallback(
    (json: GoogleConnectionsResponse) => {
      hasDataRef.current = true;
      setData(json);
      writeDeviceSnapshot(SNAPSHOT, ownerEmail, json);
    },
    [ownerEmail],
  );

  const reload = useCallback(
    async (force = false) => {
      if (!hasDataRef.current && !peekGoogleConnectionsCache()) setLoading(true);
      setError(null);
      try {
        // Gate da agenda: DB-only primeiro; health live em background.
        const json = await fetchGoogleConnections({
          light: lightFirst && !force,
          force,
        });
        applyData(json);
        if (lightFirst && !force) {
          void fetchGoogleConnections({ force: true })
            .then(applyData)
            .catch(() => undefined);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao verificar Google');
        if (!hasDataRef.current && !peekGoogleConnectionsCache()) setData(null);
      } finally {
        setLoading(false);
      }
    },
    [lightFirst, applyData],
  );

  useEffect(() => {
    const cached =
      peekGoogleConnectionsCache() ??
      readDeviceSnapshot<GoogleConnectionsResponse>(SNAPSHOT, ownerEmail);
    if (cached) {
      hasDataRef.current = true;
      setData(cached);
      setLoading(false);
    }
    void reload(false);
  }, [reload, ownerEmail]);

  const showAlert =
    !!data &&
    (data.needsConnect || data.needsReconnect || data.healthy === false);

  return { data, loading, error, reload: () => reload(true), showAlert };
}

export function googleAuthorizeUrl(redirectPath: string): string {
  const redirect = encodeURIComponent(redirectPath);
  return `/api/auth/google-authorize?scope=all&redirect=${redirect}`;
}
