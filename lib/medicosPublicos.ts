import { supabaseAdmin } from '@/lib/supabaseClient';
import { profissionalAgendaConectada } from '@/lib/publicAgendamentoCalendar';
import {
  normNomeMedico as normNome,
  type MedicoPublico,
  type MedicosPublicosResult,
} from '@/lib/medicosPublicosFormat';

export * from '@/lib/medicosPublicosFormat';

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
