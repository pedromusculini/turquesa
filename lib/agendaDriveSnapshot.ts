import { salvarArquivoNoDrive, listarArquivosMedSupApp, deletarArquivoDoDrive } from '@/lib/googleDrive';
import { listConsultasAgendaForOwner, type ConsultaAgendaRow } from '@/lib/consultasAgenda';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';

const TZ = 'America/Sao_Paulo';
export const AGENDA_SNAPSHOT_PREFIX = 'agenda_snapshot_';
const RETENTION_DAYS = 30;
const DELETED_LOOKBACK_DAYS = 30;
const DELETED_LIMIT = 50;

/** owner → YYYY-MM-DD do último snapshot gravado neste processo */
const lastSnapshotDateByOwner = new Map<string, string>();

export type AgendaDriveSnapshot = {
  version: 1;
  owner_email: string;
  snapshot_date: string;
  created_at: string;
  consultas_ativas: ConsultaAgendaRow[];
  consultas_excluidas_recentes: ConsultaAgendaRow[];
  _backup: {
    reason: 'daily';
    source: 'consultas_agenda';
    automatic: true;
  };
};

function todayDateKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function snapshotFileName(dateKey: string): string {
  return `${AGENDA_SNAPSHOT_PREFIX}${dateKey}.json`;
}

async function fetchRecentlyDeletedConsultas(
  ownerEmail: string,
): Promise<ConsultaAgendaRow[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const minDeleted = new Date(
    Date.now() - DELETED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', minDeleted)
    .order('deleted_at', { ascending: false })
    .limit(DELETED_LIMIT);

  if (error?.message?.includes('deleted_at')) return [];
  if (error) throw error;
  return (data ?? []) as ConsultaAgendaRow[];
}

export async function buildAgendaDriveSnapshot(
  ownerEmail: string,
): Promise<AgendaDriveSnapshot> {
  const owner = ownerEmail.toLowerCase().trim();
  const snapshotDate = todayDateKey();
  const [ativas, excluidas] = await Promise.all([
    listConsultasAgendaForOwner(owner, { daysPast: 180, daysFuture: 365 }),
    fetchRecentlyDeletedConsultas(owner),
  ]);

  return {
    version: 1,
    owner_email: owner,
    snapshot_date: snapshotDate,
    created_at: new Date().toISOString(),
    consultas_ativas: ativas,
    consultas_excluidas_recentes: excluidas,
    _backup: {
      reason: 'daily',
      source: 'consultas_agenda',
      automatic: true,
    },
  };
}

async function snapshotAlreadyExistsToday(
  accessToken: string,
  dateKey: string,
): Promise<boolean> {
  const files = await listarArquivosMedSupApp(accessToken, {
    namePrefix: snapshotFileName(dateKey),
    mimeTypes: ['application/json', 'application/json;charset=utf-8'],
  });
  return files.some((f) => f.name === snapshotFileName(dateKey));
}

async function pruneOldAgendaSnapshots(accessToken: string): Promise<void> {
  const files = await listarArquivosMedSupApp(accessToken, {
    namePrefix: AGENDA_SNAPSHOT_PREFIX,
    mimeTypes: ['application/json', 'application/json;charset=utf-8'],
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffKey = cutoff.toLocaleDateString('en-CA', { timeZone: TZ });

  for (const file of files) {
    const match = file.name.match(/^agenda_snapshot_(\d{4}-\d{2}-\d{2})\.json$/);
    if (!match) continue;
    if (match[1] < cutoffKey && file.id) {
      await deletarArquivoDoDrive(accessToken, file.id);
    }
  }
}

/**
 * Grava no Drive 1 snapshot por dia (fuso do salão).
 * Não altera Supabase nem Google Calendar.
 */
export async function maybeDailyAgendaSnapshot(
  accessToken: string,
  ownerEmail: string,
): Promise<string | null> {
  const owner = ownerEmail.toLowerCase().trim();
  const dateKey = todayDateKey();

  if (lastSnapshotDateByOwner.get(owner) === dateKey) return null;

  if (await snapshotAlreadyExistsToday(accessToken, dateKey)) {
    lastSnapshotDateByOwner.set(owner, dateKey);
    return null;
  }

  const payload = await buildAgendaDriveSnapshot(owner);
  const fileName = snapshotFileName(dateKey);
  await salvarArquivoNoDrive(
    accessToken,
    fileName,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  );

  lastSnapshotDateByOwner.set(owner, dateKey);
  await pruneOldAgendaSnapshots(accessToken).catch((err) => {
    console.warn('[agendaDriveSnapshot] prune falhou:', err);
  });

  return fileName;
}

/** Dispara snapshot em background (não bloqueia sync da agenda). */
export function scheduleDailyAgendaSnapshot(params: {
  ownerEmail: string;
  googleSub: string;
  cookieDriveToken?: string | null;
}): void {
  const { ownerEmail, googleSub, cookieDriveToken } = params;
  const owner = ownerEmail.toLowerCase().trim();

  void (async () => {
    try {
      let driveToken = cookieDriveToken ?? null;
      if (!driveToken) {
        driveToken = await getOwnerGoogleAccessToken(googleSub, 'drive');
      }
      if (!driveToken) return;

      const fileName = await maybeDailyAgendaSnapshot(driveToken, owner);
      if (fileName) {
        console.info(
          '[agendaDriveSnapshot]',
          JSON.stringify({ owner_email: owner, file: fileName }),
        );
      }
    } catch (err) {
      console.warn('[agendaDriveSnapshot] falhou:', err);
    }
  })();
}
