import {
  deletarArquivoDoDrive,
  listarArquivosMedSupApp,
  salvarArquivoNoDrive,
} from '@/lib/googleDrive';
import type { ClientesDriveStore } from '@/lib/clientesDrive';

export const CLIENTES_BACKUP_PREFIX = 'clientes_backup_';
const AUTO_REASON = 'auto';
/** Intervalo mínimo entre snapshots automáticos (evita encher o Drive). */
const AUTO_BACKUP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Quantidade máxima de arquivos `*_auto.json` mantidos no Drive. */
const AUTO_BACKUP_MAX_FILES = 48;
/** Outros snapshots (delete, unificar, etc.) — retenção menor. */
const MANUAL_BACKUP_MAX_FILES = 24;

const lastAutoBackupByOwner = new Map<string, number>();

function backupPayload(store: ClientesDriveStore, reason: string) {
  return {
    ...store,
    _backup: {
      reason,
      created_at: new Date().toISOString(),
      source: 'clientes.json',
      automatic: reason === AUTO_REASON,
    },
  };
}

function backupFileName(reason: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = reason.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 48);
  return `${CLIENTES_BACKUP_PREFIX}${stamp}_${safeReason}.json`;
}

/** Snapshot versionado (não sobrescreve clientes.json). */
export async function snapshotClientesStore(
  accessToken: string,
  store: ClientesDriveStore,
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
    await pruneClientesBackups(accessToken, { autoOnly: false }).catch(() => {});
  }
  return fileName;
}

function isAutoBackupName(name: string): boolean {
  return name.startsWith(CLIENTES_BACKUP_PREFIX) && name.includes(`_${AUTO_REASON}.json`);
}

async function pruneClientesBackups(
  accessToken: string,
  opts: { autoOnly: boolean },
): Promise<void> {
  const files = await listarArquivosMedSupApp(accessToken, {
    namePrefix: CLIENTES_BACKUP_PREFIX,
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
    namePrefix: CLIENTES_BACKUP_PREFIX,
    mimeTypes: ['application/json', 'application/json;charset=utf-8'],
  });
  const auto = files.filter((f) => isAutoBackupName(f.name));
  const newest = auto[0]?.createdTime;
  if (!newest) return null;
  return Date.now() - new Date(newest).getTime();
}

/**
 * Cria snapshot automático antes de gravar clientes.json.
 * Throttle: no máximo 1 a cada 6h por conta; falha silenciosa (não bloqueia save).
 */
export async function maybeAutoSnapshotClientesStore(
  accessToken: string,
  store: ClientesDriveStore,
): Promise<string | null> {
  if (!store.clientes?.length) return null;

  const owner = store.owner_email.toLowerCase().trim();
  const memLast = lastAutoBackupByOwner.get(owner);
  if (memLast && Date.now() - memLast < AUTO_BACKUP_MIN_INTERVAL_MS) {
    return null;
  }

  const driveAge = await latestAutoBackupAgeMs(accessToken);
  if (driveAge != null && driveAge < AUTO_BACKUP_MIN_INTERVAL_MS) {
    lastAutoBackupByOwner.set(owner, Date.now() - driveAge);
    return null;
  }

  const fileName = await snapshotClientesStore(accessToken, store, AUTO_REASON);
  lastAutoBackupByOwner.set(owner, Date.now());
  await pruneClientesBackups(accessToken, { autoOnly: true });
  return fileName;
}

/** Remove metadados internos antes de restaurar na store ativa. */
export function stripBackupMetadata(
  raw: ClientesDriveStore & { _backup?: unknown },
): ClientesDriveStore {
  const { _backup: _ignored, ...store } = raw as ClientesDriveStore & {
    _backup?: unknown;
  };
  if (!store.clientes) store.clientes = [];
  return store;
}
