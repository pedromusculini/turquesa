import { supabaseAdmin } from '@/lib/supabaseClient';
import { profissionalAgendaConectada } from '@/lib/publicAgendamentoCalendar';

export type MedicoPublico = {
  id: string | null;
  nome: string;
  crm: string | null;
  specialty: string | null;
  agenda_conectada: boolean;
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
  const idx = list.findIndex((x) => normNome(x.nome) === normNome(m.nome));
  if (idx >= 0) {
    if (m.agenda_conectada) list[idx].agenda_conectada = true;
    if (m.id && !list[idx].id) list[idx].id = m.id;
    return;
  }
  list.push({
    id: m.id,
    nome: m.nome.trim(),
    crm: m.crm?.trim() || null,
    specialty: m.specialty?.trim() || null,
    agenda_conectada: m.agenda_conectada,
  });
}

/** Médicos visíveis em fluxos públicos (formulário e agendamento). */
export async function loadMedicosPublicos(
  ownerEmail: string,
): Promise<MedicosPublicosResult> {
  const email = ownerEmail.toLowerCase().trim();
  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('user_type, full_name, clinic_name, crm, specialty, plan')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    return { isClinica: false, medicos: [] };
  }

  const { data: meds } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome, crm, specialty')
    .eq('clinica_email', email)
    .eq('ativo', true)
    .order('nome', { ascending: true });

  const medicos: MedicoPublico[] = [];
  const titular =
    profile.full_name?.trim() || profile.clinic_name?.trim() || '';

  if (titular) {
    const titularRow = (meds ?? []).find((m) =>
      normNome(String(m.nome ?? '')) === normNome(titular),
    );
    pushUnique(medicos, {
      id: (titularRow?.id as string | undefined) ?? null,
      nome: titular,
      crm: profile.crm?.trim() || null,
      specialty: profile.specialty?.trim() || null,
      agenda_conectada: false,
    });
  }

  for (const m of meds ?? []) {
    pushUnique(medicos, {
      id: m.id as string,
      nome: m.nome ?? '',
      crm: m.crm,
      specialty: m.specialty,
      agenda_conectada: false,
    });
  }

  await Promise.all(
    medicos.map(async (m) => {
      m.agenda_conectada = await profissionalAgendaConectada(email, m.nome);
    }),
  );

  const isClinica =
    profile.user_type === 'clinica' ||
    profile.plan === 'ilimitado' ||
    (meds?.length ?? 0) > 0;

  return { isClinica, medicos };
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
  if (m.crm) parts.push(m.crm);
  if (m.specialty) parts.push(m.specialty);
  return parts.join(' · ');
}

export function medicosPublicosAgendaveis(medicos: MedicoPublico[]): MedicoPublico[] {
  return medicos.filter((m) => m.agenda_conectada);
}

export function defaultMedicoPublicoNome(medicos: MedicoPublico[]): string {
  const bookable = medicosPublicosAgendaveis(medicos);
  return bookable.length === 1 ? bookable[0].nome : '';
}

export function needsMedicoPublicoChoice(medicos: MedicoPublico[]): boolean {
  return medicosPublicosAgendaveis(medicos).length > 1;
}

export function validateMedicoPublico(
  result: MedicosPublicosResult,
  nomeSelecionado: string,
  options?: { requireAgenda?: boolean },
): string | undefined {
  const requireAgenda = options?.requireAgenda ?? false;
  const bookable = medicosPublicosAgendaveis(result.medicos);

  if (result.isClinica && result.medicos.length === 0) {
    return 'Nenhum profissional disponível. Entre em contato com o salão.';
  }
  if (requireAgenda && bookable.length === 0) {
    return 'Nenhum profissional com agenda conectada. Entre em contato com o salão.';
  }
  const escolhaObrigatoria = requireAgenda
    ? bookable.length > 1
    : result.medicos.length > 1;
  if (escolhaObrigatoria && !nomeSelecionado.trim()) {
    return 'Selecione o profissional';
  }
  const nome = nomeSelecionado.trim() || defaultMedicoPublicoNome(result.medicos);
  const chosen = findMedicoPublico(result.medicos, nome);
  if (nome && !chosen) {
    return 'Profissional inválido';
  }
  if (requireAgenda && chosen && !chosen.agenda_conectada) {
    return 'Profissional sem agenda conectada';
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
