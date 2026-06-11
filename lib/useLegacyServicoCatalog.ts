'use client';

import { useEffect, useState } from 'react';
import {
  legacyCatalogFromPayload,
  type LegacyServicoCatalog,
} from '@/lib/legacyProcedimentoCatalog';

export function useLegacyServicoCatalog(ownerEmail: string) {
  const [catalog, setCatalog] = useState<LegacyServicoCatalog | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ownerEmail) {
      setCatalog(null);
      setIsLegacy(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    fetch('/api/legacy/servico-catalog')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.legacy) {
          setIsLegacy(true);
          setCatalog(
            legacyCatalogFromPayload({
              servicos: data.servicos,
              clienteNomes: data.clienteNomes,
            }),
          );
        } else {
          setIsLegacy(false);
          setCatalog(null);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ownerEmail]);

  return { catalog, isLegacy, ready };
}
