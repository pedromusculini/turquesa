/** Carrega nomes para o select de profissional (titular + equipe cadastrada). */
import { canManageProfissionais } from '@/lib/salaoEquipeAccess';

export type MedicosOptionsResult = {
  medicos: string[];
  isClinica: boolean;
};

function mergeMedicosList(
  titular: string,
  cadastrados: string[],
): string[] {
  const medicos: string[] = [];
  if (titular) {
    const dup = cadastrados.some((n) => n.toLowerCase() === titular.toLowerCase());
    if (!dup) medicos.push(titular);
  }
  for (const n of cadastrados) {
    if (!medicos.some((x) => x.toLowerCase() === n.toLowerCase())) {
      medicos.push(n);
    }
  }
  return medicos;
}

export async function loadMedicosOptions(): Promise<MedicosOptionsResult> {
  const res = await fetch('/api/perfil');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { medicos: [], isClinica: false };
  }

  const profile = data.profile ?? data;
  if (!profile || !canManageProfissionais(profile)) {
    const solo = profile?.full_name?.trim();
    return {
      medicos: solo ? [solo] : [],
      isClinica: false,
    };
  }

  const medRes = await fetch('/api/perfil/medicos');
  const medData = await medRes.json().catch(() => ({}));
  const cadastrados: string[] = medRes.ok
    ? (medData.medicos ?? medData.profissionais ?? [])
        .map((m: { nome: string }) => m.nome.trim())
        .filter(Boolean)
    : [];

  const titular =
    profile.full_name?.trim() || profile.clinic_name?.trim() || '';
  const medicos = mergeMedicosList(titular, cadastrados);

  return { medicos, isClinica: true };
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
    return 'Cadastre profissionais em Catálogo → Profissionais antes de continuar.';
  }
  if (medicos.length > 0 && !resolveMedicoValue(medicos, medico)) {
    return 'Selecione a profissional';
  }
  return undefined;
}
