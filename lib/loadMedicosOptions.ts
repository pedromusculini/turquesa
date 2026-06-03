/** Carrega nomes para o select de médico (clínica: equipe + titular; solo: nome do perfil). */
export type MedicosOptionsResult = {
  medicos: string[];
  isClinica: boolean;
};

export async function loadMedicosOptions(): Promise<MedicosOptionsResult> {
  const res = await fetch('/api/perfil');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { medicos: [], isClinica: false };
  }

  const profile = data.profile ?? data;

  if (profile?.user_type === 'clinica') {
    const medRes = await fetch('/api/perfil/medicos');
    const medData = await medRes.json().catch(() => ({}));
    const cadastrados: string[] = medRes.ok
      ? (medData.medicos ?? []).map((m: { nome: string }) => m.nome.trim()).filter(Boolean)
      : [];

    const titular =
      profile.full_name?.trim() || profile.clinic_name?.trim() || '';
    const medicos: string[] = [];
    if (titular) {
      const dup = cadastrados.some(
        (n) => n.toLowerCase() === titular.toLowerCase(),
      );
      if (!dup) medicos.push(titular);
    }
    for (const n of cadastrados) {
      if (!medicos.some((x) => x.toLowerCase() === n.toLowerCase())) {
        medicos.push(n);
      }
    }

    return { medicos, isClinica: true };
  }

  const solo = profile?.full_name?.trim();
  return {
    medicos: solo ? [solo] : [],
    isClinica: false,
  };
}

/** Valor padrão quando há um único médico na lista */
export function defaultMedicoFromList(medicos: string[]): string {
  return medicos.length === 1 ? medicos[0] : '';
}

export function resolveMedicoValue(medicos: string[], medico: string): string {
  const trimmed = medico.trim();
  if (trimmed) return trimmed;
  return defaultMedicoFromList(medicos);
}

export function validateMedicoSelection(
  medicos: string[],
  medico: string,
  isClinica: boolean,
): string | undefined {
  if (isClinica && medicos.length === 0) {
    return 'Cadastre médicos em Meu Perfil antes de continuar.';
  }
  if (medicos.length > 0 && !resolveMedicoValue(medicos, medico)) {
    return 'Selecione o médico';
  }
  return undefined;
}
