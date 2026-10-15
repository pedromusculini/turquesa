'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MedicosOptionsResult, ProfissionalOption } from '@/lib/loadMedicosOptions';
import {
  loadMedicosOptionsCached,
  peekMedicosOptionsCache,
} from '@/lib/medicosOptionsCache';
import { readDeviceSnapshot, writeDeviceSnapshot } from '@/lib/deviceSnapshot';

const SNAPSHOT = 'medicos-options';

/** `ownerEmail` liga o último estado salvo no aparelho (abre sem esperar a rede). */
export function useMedicosOptions(ownerEmail?: string | null) {
  const [medicos, setMedicos] = useState<string[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOption[]>([]);
  const [isClinica, setIsClinica] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  const apply = useCallback((r: MedicosOptionsResult) => {
    hasDataRef.current = true;
    setMedicos(r.medicos);
    setProfissionais(r.profissionais);
    setIsClinica(r.isClinica);
  }, []);

  const reload = useCallback(async (force = false) => {
    if (!hasDataRef.current && !peekMedicosOptionsCache()) setLoading(true);
    try {
      const r = await loadMedicosOptionsCached({ force });
      apply(r);
      writeDeviceSnapshot(SNAPSHOT, ownerEmail, r);
    } catch {
      if (!hasDataRef.current) {
        setMedicos([]);
        setProfissionais([]);
        setIsClinica(false);
      }
    } finally {
      setLoading(false);
    }
  }, [apply, ownerEmail]);

  useEffect(() => {
    const cached =
      peekMedicosOptionsCache() ??
      readDeviceSnapshot<MedicosOptionsResult>(SNAPSHOT, ownerEmail);
    if (cached && Array.isArray(cached.medicos) && Array.isArray(cached.profissionais)) {
      apply(cached);
      setLoading(false);
    }
    void reload(false);
  }, [apply, reload, ownerEmail]);

  return {
    medicos,
    profissionais,
    isClinica,
    loading,
    reload: () => reload(true),
  };
}
