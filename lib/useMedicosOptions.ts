'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MedicosOptionsResult, ProfissionalOption } from '@/lib/loadMedicosOptions';
import {
  loadMedicosOptionsCached,
  peekMedicosOptionsCache,
} from '@/lib/medicosOptionsCache';

export function useMedicosOptions() {
  const [medicos, setMedicos] = useState<string[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOption[]>([]);
  const [isClinica, setIsClinica] = useState(false);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((r: MedicosOptionsResult) => {
    setMedicos(r.medicos);
    setProfissionais(r.profissionais);
    setIsClinica(r.isClinica);
  }, []);

  const reload = useCallback(async (force = false) => {
    if (!peekMedicosOptionsCache()) setLoading(true);
    try {
      const r = await loadMedicosOptionsCached({ force });
      apply(r);
    } catch {
      setMedicos([]);
      setProfissionais([]);
      setIsClinica(false);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    const cached = peekMedicosOptionsCache();
    if (cached) {
      apply(cached);
      setLoading(false);
    }
    void reload(false);
  }, [apply, reload]);

  return {
    medicos,
    profissionais,
    isClinica,
    loading,
    reload: () => reload(true),
  };
}
