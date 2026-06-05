'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadMedicosOptions,
  type MedicosOptionsResult,
  type ProfissionalOption,
} from '@/lib/loadMedicosOptions';

export function useMedicosOptions() {
  const [medicos, setMedicos] = useState<string[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOption[]>([]);
  const [isClinica, setIsClinica] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r: MedicosOptionsResult = await loadMedicosOptions();
      setMedicos(r.medicos);
      setProfissionais(r.profissionais);
      setIsClinica(r.isClinica);
    } catch {
      setMedicos([]);
      setProfissionais([]);
      setIsClinica(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { medicos, profissionais, isClinica, loading, reload };
}
