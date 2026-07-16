import type { GoogleContactImport } from '@/lib/googleContacts';
import {
  createClienteRecord,
  findExistingClienteByPhoneOrEmail,
  type ClienteDriveRecord,
  type ClientesDriveStore,
} from '@/lib/clientesDrive';

const GOOGLE_IMPORT_TAG = 'Importado do Google Contatos';

export function ensureGoogleContactId(
  cliente: ClienteDriveRecord,
  resourceName: string,
): void {
  if (!resourceName) return;
  const ids = cliente.google_contact_ids ?? [];
  if (!ids.includes(resourceName)) {
    cliente.google_contact_ids = [...ids, resourceName];
  }
}

export function mergeGoogleContactIds(
  primary: ClienteDriveRecord,
  secondary: ClienteDriveRecord,
): void {
  const merged = new Set([...(primary.google_contact_ids ?? []), ...(secondary.google_contact_ids ?? [])]);
  if (merged.size > 0) {
    primary.google_contact_ids = Array.from(merged);
  }
}

export function recordClienteMergeMap(
  store: ClientesDriveStore,
  primaryId: string,
  secondaryId: string,
): void {
  if (!store.clientes_merge_map) store.clientes_merge_map = {};
  store.clientes_merge_map[secondaryId] = primaryId;
}

/** Resolve primary quando o cadastro secundário foi unificado e removido. */
export function resolveMergedPrimaryId(
  store: ClientesDriveStore,
  clienteId: string,
): string {
  const map = store.clientes_merge_map ?? {};
  let current = clienteId;
  const seen = new Set<string>();
  while (map[current] && !seen.has(current)) {
    seen.add(current);
    current = map[current];
  }
  return current;
}

function findClienteByGoogleResourceName(
  store: ClientesDriveStore,
  resourceName: string,
): ClienteDriveRecord | undefined {
  if (!resourceName) return undefined;
  return store.clientes.find((c) => c.google_contact_ids?.includes(resourceName));
}

/**
 * Busca cliente existente para um contato Google.
 * Só resourceName + telefone/e-mail/CPF — sem match por nome (evita absorver
 * contato novo em linha de planilha / homônimo).
 */
export function findClienteForGoogleContact(
  store: ClientesDriveStore,
  contact: GoogleContactImport,
): ClienteDriveRecord | undefined {
  const byResource = findClienteByGoogleResourceName(store, contact.googleResourceName);
  if (byResource) return byResource;

  return findExistingClienteByPhoneOrEmail(store, {
    nome: contact.nome,
    email: contact.email,
    telefone: contact.telefone,
  });
}

export function enrichClienteFromGoogleContact(
  cliente: ClienteDriveRecord,
  contact: GoogleContactImport,
): void {
  ensureGoogleContactId(cliente, contact.googleResourceName);

  if (!cliente.email && contact.email) cliente.email = contact.email;
  if (!cliente.telefone && contact.telefone) cliente.telefone = contact.telefone;
  if (!cliente.data_nascimento && contact.data_nascimento) {
    cliente.data_nascimento = contact.data_nascimento;
  }

  if (cliente.observacoes_gerais && !cliente.observacoes_gerais.includes(GOOGLE_IMPORT_TAG)) {
    cliente.observacoes_gerais = `${cliente.observacoes_gerais}\n${GOOGLE_IMPORT_TAG}`;
  } else if (!cliente.observacoes_gerais) {
    cliente.observacoes_gerais = GOOGLE_IMPORT_TAG;
  }

  cliente.updated_at = new Date().toISOString();
}

export type GoogleContactsImportResult = {
  criados: number;
  ignorados: number;
  vinculados: number;
  changed: boolean;
};

export type GoogleContactsManualImportResult = {
  criados: ClienteDriveRecord[];
  ignorados: number;
};

/** Importação manual (UI): sempre cria cadastro novo — sem dedup por telefone/nome/e-mail. */
export function importGoogleContactsAsNew(
  store: ClientesDriveStore,
  contacts: GoogleContactImport[],
): GoogleContactsManualImportResult {
  const criados: ClienteDriveRecord[] = [];
  let ignorados = 0;

  for (const contact of contacts) {
    const nome = contact.nome?.trim();
    if (!nome || nome.length < 2) {
      ignorados++;
      continue;
    }

    if (
      contact.googleResourceName &&
      findClienteByGoogleResourceName(store, contact.googleResourceName)
    ) {
      ignorados++;
      continue;
    }

    const cliente = createClienteRecord({
      nome: contact.nome,
      email: contact.email,
      telefone: contact.telefone,
      data_nascimento: contact.data_nascimento,
      observacoes_gerais: GOOGLE_IMPORT_TAG,
    });
    ensureGoogleContactId(cliente, contact.googleResourceName);
    store.clientes.push(cliente);
    criados.push(cliente);
  }

  return { criados, ignorados };
}

/** Importa contatos Google no store Drive sem recriar cadastros unificados. */
export function importGoogleContactsIntoStore(
  store: ClientesDriveStore,
  contacts: GoogleContactImport[],
): GoogleContactsImportResult {
  let criados = 0;
  let ignorados = 0;
  let vinculados = 0;

  for (const contact of contacts) {
    const existente = findClienteForGoogleContact(store, contact);

    if (existente) {
      ignorados++;
      const hadLink = existente.google_contact_ids?.includes(contact.googleResourceName);
      enrichClienteFromGoogleContact(existente, contact);
      if (!hadLink && contact.googleResourceName) vinculados++;
      continue;
    }

    const cliente = createClienteRecord({
      nome: contact.nome,
      email: contact.email,
      telefone: contact.telefone,
      data_nascimento: contact.data_nascimento,
      observacoes_gerais: GOOGLE_IMPORT_TAG,
    });
    ensureGoogleContactId(cliente, contact.googleResourceName);
    store.clientes.push(cliente);
    criados++;
  }

  return {
    criados,
    ignorados,
    vinculados,
    changed: criados > 0 || ignorados > 0,
  };
}
