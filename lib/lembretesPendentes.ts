import type { ConsultaAgendaRow, LembreteTipo } from '@/lib/consultasAgenda';
import {
  addDaysToKey,
  brDateKey,
  brTodayKey,
  daysBetweenKeys,
  lembreteRemovidoTipo,
  queryConsultasAgendaForDay,
  queryConsultasAgendaInRange,
} from '@/lib/consultasAgenda';
import { getConsultaCalendarLinksMap } from '@/lib/calendarToken';
import { enderecoVarsFromProfile, loadOwnerProfile } from '@/lib/agendamento';
import { getLembretesSettings } from '@/lib/lembretesSettings';
import {
  formatConsultaDataHora,
  getMensagensConfig,
  renderMensagem,
  type MensagemTipo,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrls } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { syncConsultasAgendaFromGoogleCalendars } from '@/lib/syncConsultasFromGoogleServer';

export type LembretePendenteItem = ConsultaAgendaRow & {
  data: string;
  hora: string;
  mensagem: string;
  enviado: boolean;
  whatsapp_url: string | null;
  whatsapp_app_url: string | null;
  whatsapp_android_url: string | null;
};

type TelefoneIndex = {
  byDriveId: Map<string, string>;
  byNome: Map<string, string>;
};

async function loadPacienteTelefoneIndex(owner: string): Promise<TelefoneIndex> {
  const byDriveId = new Map<string, string>();
  const byNome = new Map<string, string>();

  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('cliente_drive_id, nome, telefone_normalizado')
    .eq('owner_email', owner)
    .not('telefone_normalizado', 'is', null);

  if (error) {
    if (error.code === 'PGRST205') return { byDriveId, byNome };
    throw error;
  }

  for (const row of data ?? []) {
    const tel = row.telefone_normalizado as string | null;
    if (!tel?.replace(/\D/g, '').length) continue;
    const driveId = row.cliente_drive_id as string | null;
    if (driveId && !byDriveId.has(driveId)) byDriveId.set(driveId, tel);
    const nomeKey = String(row.nome ?? '')
      .trim()
      .toLowerCase();
    if (nomeKey && !byNome.has(nomeKey)) byNome.set(nomeKey, tel);
  }

  return { byDriveId, byNome };
}

function resolveTelefoneFromIndex(
  row: ConsultaAgendaRow,
  index: TelefoneIndex,
): string | null {
  const direct = row.telefone?.replace(/\D/g, '');
  if (direct?.length) return row.telefone;

  if (row.cliente_drive_id) {
    const fromDrive = index.byDriveId.get(row.cliente_drive_id);
    if (fromDrive?.replace(/\D/g, '').length) return fromDrive;
  }

  const nomeKey = row.paciente.trim().toLowerCase();
  if (nomeKey) {
    const fromNome = index.byNome.get(nomeKey);
    if (fromNome?.replace(/\D/g, '').length) return fromNome;
  }

  return null;
}

async function loadLembreteStatusSet(consultaIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (!consultaIds.length) return set;

  const { data, error } = await supabaseAdmin
    .from('whatsapp_lembrete_enviado')
    .select('consulta_id, lembrete_tipo')
    .in('consulta_id', consultaIds);

  if (error) {
    if (error.code === 'PGRST205') return set;
    throw error;
  }

  for (const row of data ?? []) {
    set.add(`${row.consulta_id as string}:${row.lembrete_tipo as string}`);
  }
  return set;
}

function filterConsultasForLembrete(
  rows: ConsultaAgendaRow[],
  targetKey: string | null,
  tipo: LembreteTipo,
  index: TelefoneIndex,
  lembreteSet: Set<string>,
  options?: { matchDay?: boolean },
): ConsultaAgendaRow[] {
  const filtered: ConsultaAgendaRow[] = [];

  for (const row of rows) {
    const rowDay = brDateKey(row.inicio);
    if (options?.matchDay === false) {
      if (targetKey != null && rowDay === targetKey) continue;
    } else if (targetKey != null && rowDay !== targetKey) {
      continue;
    }
    const telefone = resolveTelefoneFromIndex(row, index);
    if (!telefone?.replace(/\D/g, '').length) continue;
    if (lembreteSet.has(`${row.id}:${lembreteRemovidoTipo(tipo)}`)) continue;
    filtered.push({ ...row, telefone });
  }

  return filtered.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function enrichList(
  list: ConsultaAgendaRow[],
  templateTipo: MensagemTipo,
  lembreteTipo: LembreteTipo,
  lembreteSet: Set<string>,
  calendarLinks: Map<string, string>,
  mensagensConfig: Awaited<ReturnType<typeof getMensagensConfig>>,
  clinica: string,
  localPerfil: string,
  link_maps: string,
): LembretePendenteItem[] {
  const template = mensagensConfig[templateTipo];

  return list.map((c) => {
    const { data, hora } = formatConsultaDataHora(c.inicio);
    const linkCal = calendarLinks.get(c.id) ?? '';
    const mensagem = renderMensagem(
      template,
      {
        nome: c.paciente,
        data,
        hora,
        medico: c.medico || '',
        local: c.local || localPerfil,
        clinica,
        link_calendario: linkCal,
        link_maps,
      },
      templateTipo,
    );
    const urls = c.telefone ? buildWhatsAppUrls(c.telefone, mensagem) : null;
    const enviado = lembreteSet.has(`${c.id}:${lembreteTipo}`);

    return {
      ...c,
      data,
      hora,
      mensagem,
      enviado,
      whatsapp_url: urls?.web ?? null,
      whatsapp_app_url: urls?.app ?? null,
      whatsapp_android_url: urls?.android ?? null,
    };
  });
}

export async function buildLembretesPendentesResponse(
  ownerEmail: string,
  options?: { syncGoogle?: boolean },
): Promise<{
  lembretes7: LembretePendenteItem[];
  lembretes7Atrasados: LembretePendenteItem[];
  lembretes1: LembretePendenteItem[];
  settings: Awaited<ReturnType<typeof getLembretesSettings>>;
}> {
  const owner = ownerEmail.toLowerCase().trim();
  const settings = await getLembretesSettings(owner);

  if (options?.syncGoogle) {
    try {
      await syncConsultasAgendaFromGoogleCalendars(owner);
    } catch (syncErr) {
      console.warn('[lembretesPendentes] sync Google:', syncErr);
    }
  }

  const today = brTodayKey();
  const d7Target =
    settings.lembrete_antecedencia_ativo
      ? addDaysToKey(today, settings.lembrete_antecedencia_dias)
      : null;
  const d1Target = settings.lembrete_1_dia_ativo ? addDaysToKey(today, 1) : null;
  const catchUpTo =
    settings.lembrete_antecedencia_ativo && settings.lembrete_antecedencia_dias > 1
      ? addDaysToKey(today, settings.lembrete_antecedencia_dias - 1)
      : null;

  const [index, profile, mensagensConfig, rowsD7, rowsD1, rowsCatchUp] = await Promise.all([
    loadPacienteTelefoneIndex(owner),
    loadOwnerProfile(owner),
    getMensagensConfig(owner),
    d7Target ? queryConsultasAgendaForDay(owner, d7Target) : Promise.resolve([]),
    d1Target ? queryConsultasAgendaForDay(owner, d1Target) : Promise.resolve([]),
    catchUpTo
      ? queryConsultasAgendaInRange(owner, addDaysToKey(today, 1), catchUpTo)
      : Promise.resolve([]),
  ]);

  const allIds = [...new Set([...rowsD7, ...rowsD1, ...rowsCatchUp].map((r) => r.id))];
  const lembreteSet = await loadLembreteStatusSet(allIds);

  const d7 =
    d7Target != null
      ? filterConsultasForLembrete(rowsD7, d7Target, 'd7', index, lembreteSet)
      : [];

  const d7CatchUpRaw = rowsCatchUp.filter((row) => {
    const rowDay = brDateKey(row.inicio);
    const daysUntil = daysBetweenKeys(today, rowDay);
    return (
      daysUntil >= 1 &&
      daysUntil < settings.lembrete_antecedencia_dias &&
      !lembreteSet.has(`${row.id}:d7`) &&
      !lembreteSet.has(`${row.id}:${lembreteRemovidoTipo('d7')}`)
    );
  });
  const d7Atrasados = filterConsultasForLembrete(
    d7CatchUpRaw,
    null,
    'd7',
    index,
    lembreteSet,
    { matchDay: false },
  );

  const d1 =
    d1Target != null
      ? filterConsultasForLembrete(rowsD1, d1Target, 'd1', index, lembreteSet)
      : [];

  const clinica =
    String(profile?.clinic_name ?? profile?.full_name ?? '').trim() || 'seu salão';
  const { local: localPerfil, link_maps } = enderecoVarsFromProfile(profile);

  const calendarLinks = await getConsultaCalendarLinksMap(
    [...new Set([...d7, ...d7Atrasados, ...d1].map((c) => c.id))],
    owner,
  );

  const lembretes7 = enrichList(
    d7,
    'lembrete_7_dias',
    'd7',
    lembreteSet,
    calendarLinks,
    mensagensConfig,
    clinica,
    localPerfil,
    link_maps,
  );
  const lembretes7Atrasados = enrichList(
    d7Atrasados,
    'lembrete_7_dias',
    'd7',
    lembreteSet,
    calendarLinks,
    mensagensConfig,
    clinica,
    localPerfil,
    link_maps,
  );
  const lembretes1 = enrichList(
    d1,
    'lembrete_1_dia',
    'd1',
    lembreteSet,
    calendarLinks,
    mensagensConfig,
    clinica,
    localPerfil,
    link_maps,
  );

  return { lembretes7, lembretes7Atrasados, lembretes1, settings };
}
