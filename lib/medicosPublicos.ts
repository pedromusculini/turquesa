import { supabaseAdmin } from '@/lib/supabaseClient';

export type MedicoPublico = {
  nome: string;
  crm: string | null;
  specialty: string | null;
};

export type MedicosPublicosResult = {
  isClinica: boolean;
  medicos: MedicoPublico[];
};

function normNome(n: string) {
  return n.trim().toLowerCase();
}

function pushUnique(list: MedicoPublico[], m: MedicoPublico) {
  if (!m.nome.trim()) return;
  if (list.some((x) => normNome(x.nome) === normNome(m.nome))) return;
  list.push({
    nome: m.nome.trim(),
    crm: m.crm?.trim() || null,
    specialty: m.specialty?.trim() || null,
  });
}

/** Médicos visíveis em fluxos públicos (formulário e agendamento). */
export async function loadMedicosPublicos(
  ownerEmail: string,
): Promise<MedicosPublicosResult> {
  const email = ownerEmail.toLowerCase().trim();
  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('user_type, full_name, clinic_name, crm, specialty')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    return { isClinica: false, medicos: [] };
  }

  if (profile.user_type === 'clinica') {
    const { data: meds } = await supabaseAdmin
      .from('clinica_medicos')
      .select('nome, crm, specialty')
      .eq('clinica_email', email)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    const medicos: MedicoPublico[] = [];
    const titular =
      profile.full_name?.trim() || profile.clinic_name?.trim() || '';
    if (titular) {
      pushUnique(medicos, {
        nome: titular,
        crm: profile.crm?.trim() || null,
        specialty: profile.specialty?.trim() || null,
      });
    }
    for (const m of meds ?? []) {
      pushUnique(medicos, {
        nome: m.nome ?? '',
        crm: m.crm,
        specialty: m.specialty,
      });
    }
    return { isClinica: true, medicos };
  }

  const nome = profile.full_name?.trim();
  if (!nome) return { isClinica: false, medicos: [] };
  return {
    isClinica: false,
    medicos: [
      {
        nome,
        crm: profile.crm?.trim() || null,
        specialty: profile.specialty?.trim() || null,
      },
    ],
  };
}

export function findMedicoPublico(
  medicos: MedicoPublico[],
  nome: string,
): MedicoPublico | undefined {
  const n = normNome(nome);
  return medicos.find((m) => normNome(m.nome) === n);
}

export function medicoPublicoSubtitle(m: MedicoPublico): string {
  const parts: string[] = [];
  if (m.crm) parts.push(`CRM ${m.crm}`);
  if (m.specialty) parts.push(m.specialty);
  return parts.join(' · ');
}

export function defaultMedicoPublicoNome(medicos: MedicoPublico[]): string {
  return medicos.length === 1 ? medicos[0].nome : '';
}

export function needsMedicoPublicoChoice(medicos: MedicoPublico[]): boolean {
  return medicos.length > 1;
}

export function validateMedicoPublico(
  result: MedicosPublicosResult,
  nomeSelecionado: string,
): string | undefined {
  if (result.isClinica && result.medicos.length === 0) {
    return 'Nenhum profissional disponível. Entre em contato com a clínica.';
  }
  if (result.medicos.length > 1 && !nomeSelecionado.trim()) {
    return 'Selecione o profissional';
  }
  const nome = nomeSelecionado.trim() || defaultMedicoPublicoNome(result.medicos);
  if (result.medicos.length > 0 && nome && !findMedicoPublico(result.medicos, nome)) {
    return 'Profissional inválido';
  }
  return undefined;
}

export function resolveMedicoPublicoPayload(
  result: MedicosPublicosResult,
  nomeSelecionado: string,
): { medico: string; medico_crm: string | null; medico_especialidade: string | null } | null {
  const nome = nomeSelecionado.trim() || defaultMedicoPublicoNome(result.medicos);
  if (!nome) return null;
  const m = findMedicoPublico(result.medicos, nome);
  return {
    medico: nome,
    medico_crm: m?.crm ?? null,
    medico_especialidade: m?.specialty ?? null,
  };
}
