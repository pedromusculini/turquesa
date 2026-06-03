'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadMedicosOptions,
  type MedicosOptionsResult,
} from '@/lib/loadMedicosOptions';

export function useMedicosOptions() {
  const [medicos, setMedicos] = useState<string[]>([]);
  const [isClinica, setIsClinica] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r: MedicosOptionsResult = await loadMedicosOptions();
      setMedicos(r.medicos);
      setIsClinica(r.isClinica);
    } catch {
      setMedicos([]);
      setIsClinica(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { medicos, isClinica, loading, reload };
}
