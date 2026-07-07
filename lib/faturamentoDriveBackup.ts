import {
  deletarArquivoDoDrive,
  listarArquivosMedSupApp,
  salvarArquivoNoDrive,
} from '@/lib/googleDrive';
import type { FaturamentoDriveStore } from '@/lib/clientesDrive';
import { buildFullFaturamentoStoreFromSupabase } from '@/lib/faturamentoDriveSync';

export const FATURAMENTO_BACKUP_PREFIX = 'faturamento_backup_';
const AUTO_REASON = 'auto';
const AUTO_BACKUP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const AUTO_BACKUP_MAX_FILES = 48;
const MANUAL_BACKUP_MAX_FILES = 24;

const lastAutoBackupByOwner = new Map<string, number>();

function backupPayload(store: FaturamentoDriveStore, reason: string) {
  return {
    ...store,
    _backup: {
      reason,
      created_at: new Date().toISOString(),
      source: 'faturamento.json',
      automatic: reason === AUTO_REASON,
    },
  };
}

function backupFileName(reason: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = reason.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 48);
  return `${FATURAMENTO_BACKUP_PREFIX}${stamp}_${safeReason}.json`;
}

export async function snapshotFaturamentoStore(
  accessToken: string,
  store: FaturamentoDriveStore,
  reason: string,
): Promise<string> {
  const fileName = backupFileName(reason);
  await salvarArquivoNoDrive(
    accessToken,
    fileName,
    JSON.stringify(backupPayload(store, reason), null, 2),
    'application/json;charset=utf-8',
  );
  if (reason !== AUTO_REASON) {
    await pruneFaturamentoBackups(accessToken, { autoOnly: false }).catch(() => {});
  }
  return fileName;
}

function isAutoBackupName(name: string): boolean {
  return (
    name.startsWith(FATURAMENTO_BACKUP_PREFIX) && name.includes(`_${AUTO_REASON}.json`)
  );
}

async function pruneFaturamentoBackups(
  accessToken: string,
  opts: { autoOnly: boolean },
): Promise<void> {
  const files = await listarArquivosMedSupApp(accessToken, {
    namePrefix: FATURAMENTO_BACKUP_PREFIX,
    mimeTypes: ['application/json', 'application/json;charset=utf-8'],
  });

  const auto = files.filter((f) => isAutoBackupName(f.name));
  const manual = files.filter((f) => !isAutoBackupName(f.name));

  const toDelete: string[] = [];
  if (!opts.autoOnly) {
    for (const f of manual.slice(MANUAL_BACKUP_MAX_FILES)) {
      if (f.id) toDelete.push(f.id);
    }
  }
  for (const f of auto.slice(AUTO_BACKUP_MAX_FILES)) {
    if (f.id) toDelete.push(f.id);
  }

  for (const id of toDelete) {
    await deletarArquivoDoDrive(accessToken, id);
  }
}

async function latestAutoBackupAgeMs(accessToken: string): Promise<number | null> {
  const files = await listarArquivosMedSupApp(accessToken, {
    namePrefix: FATURAMENTO_BACKUP_PREFIX,
    mimeTypes: ['application/json', 'application/json;charset=utf-8'],
  });
  const auto = files.filter((f) => isAutoBackupName(f.name));
  const newest = auto[0]?.createdTime;
  if (!newest) return null;
  return Date.now() - new Date(newest).getTime();
}

export type AutoSnapshotFaturamentoResult = {
  fileName: string;
  fullStore: FaturamentoDriveStore;
};

/**
 * Snapshot automático do financeiro no Drive.
 * Quando o intervalo permite, reconstrói a store completa do Supabase antes de salvar.
 */
export async function maybeAutoSnapshotFaturamentoStore(
  accessToken: string,
  store: FaturamentoDriveStore,
): Promise<AutoSnapshotFaturamentoResult | null> {
  const owner = store.owner_email.toLowerCase().trim();
  if (!owner) return null;

  const memLast = lastAutoBackupByOwner.get(owner);
  if (memLast && Date.now() - memLast < AUTO_BACKUP_MIN_INTERVAL_MS) {
    return null;
  }

  const driveAge = await latestAutoBackupAgeMs(accessToken);
  if (driveAge != null && driveAge < AUTO_BACKUP_MIN_INTERVAL_MS) {
    lastAutoBackupByOwner.set(owner, Date.now() - driveAge);
    return null;
  }

  const fullStore = await buildFullFaturamentoStoreFromSupabase(owner);
  const fileName = await snapshotFaturamentoStore(accessToken, fullStore, AUTO_REASON);
  lastAutoBackupByOwner.set(owner, Date.now());
  await pruneFaturamentoBackups(accessToken, { autoOnly: true });
  return { fileName, fullStore };
}

export function stripFaturamentoBackupMetadata(
  raw: FaturamentoDriveStore & { _backup?: unknown },
): FaturamentoDriveStore {
  const { _backup: _ignored, ...store } = raw as FaturamentoDriveStore & {
    _backup?: unknown;
  };
  if (!store.transacoes) store.transacoes = [];
  return store;
}
