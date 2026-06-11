import type { ConsultationRecord } from '@/lib/consultations';
import {
  extractClienteFromDescricao,
  extractProcedimentoFromDescricao,
} from '@/lib/financeiroClientes';
import { FINANCEIRO_LEGACY_CATALOGO_OWNER } from '@/lib/financeiroAgregados';

export function normalizeLegacyKey(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export type LegacyServicoCatalog = {
  allowlist: Set<string>;
  displayByKey: Map<string, string>;
  clientBlocklist: Set<string>;
  clientDisplayByKey: Map<string, string>;
};

export function isLegacyCatalogOwner(email: string | null | undefined): boolean {
  if (!FINANCEIRO_LEGACY_CATALOGO_OWNER) return false;
  return email?.toLowerCase().trim() === FINANCEIRO_LEGACY_CATALOGO_OWNER;
}

export function buildLegacyServicoCatalog(sources: {
  catalogoServicos?: string[];
  clienteNomes?: string[];
  financeiroDescricoes?: string[];
}): LegacyServicoCatalog {
  const allowlist = new Set<string>();
  const displayByKey = new Map<string, string>();
  const clientBlocklist = new Set<string>();
  const clientDisplayByKey = new Map<string, string>();

  const addServico = (nome: string) => {
    const t = nome.trim();
    if (!t) return;
    const k = normalizeLegacyKey(t);
    allowlist.add(k);
    if (!displayByKey.has(k)) displayByKey.set(k, t);
  };

  const addCliente = (nome: string) => {
    const t = nome.trim();
    if (!t) return;
    const k = normalizeLegacyKey(t);
    clientBlocklist.add(k);
    if (!clientDisplayByKey.has(k)) clientDisplayByKey.set(k, t);
  };

  for (const n of sources.catalogoServicos ?? []) addServico(n);
  for (const d of sources.financeiroDescricoes ?? []) {
    const proc = extractProcedimentoFromDescricao(d);
    if (proc) addServico(proc);
    const cli = extractClienteFromDescricao(d, 'entrada');
    if (cli) addCliente(cli);
  }
  for (const n of sources.clienteNomes ?? []) addCliente(n);

  for (const k of clientBlocklist) {
    allowlist.delete(k);
  }

  return { allowlist, displayByKey, clientBlocklist, clientDisplayByKey };
}

export function isClienteNome(nome: string, catalog: LegacyServicoCatalog): boolean {
  return catalog.clientBlocklist.has(normalizeLegacyKey(nome));
}

export function isAllowedServicoNome(
  nome: string,
  catalog: LegacyServicoCatalog,
): boolean {
  const k = normalizeLegacyKey(nome);
  if (!k) return false;
  if (catalog.clientBlocklist.has(k)) return false;
  return catalog.allowlist.has(k);
}

export function displayServicoNome(nome: string, catalog: LegacyServicoCatalog): string {
  return catalog.displayByKey.get(normalizeLegacyKey(nome)) ?? nome.trim();
}

/** Serviço válido no catálogo legacy; null se for nome de cliente ou desconhecido. */
export function resolveLegacyServico(
  raw: string | null | undefined,
  patient: string | null | undefined,
  catalog: LegacyServicoCatalog,
): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const k = normalizeLegacyKey(s);
  if (patient && normalizeLegacyKey(patient) === k) return null;
  if (catalog.clientBlocklist.has(k)) return null;
  if (catalog.allowlist.has(k)) return catalog.displayByKey.get(k) ?? s;
  return null;
}

export function buildFinanceiroServicoLookup(
  entradas: { data: string; descricao: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entradas) {
    const proc = extractProcedimentoFromDescricao(e.descricao);
    const cli = extractClienteFromDescricao(e.descricao, 'entrada');
    if (!proc || !cli) continue;
    const key = `${e.data.slice(0, 10)}|${normalizeLegacyKey(cli)}`;
    if (!map.has(key)) map.set(key, proc);
  }
  return map;
}

export function sanitizeConsultationServico(
  event: ConsultationRecord,
  catalog: LegacyServicoCatalog,
  financeiroLookup?: Map<string, string>,
): ConsultationRecord {
  const patient = event.patient?.trim() ?? '';
  const service = event.service?.trim() ?? '';

  const resolved = resolveLegacyServico(service, patient, catalog);
  if (resolved) return { ...event, service: resolved };

  if (financeiroLookup && patient && event.start) {
    const date = String(event.start).slice(0, 10);
    const key = `${date}|${normalizeLegacyKey(patient)}`;
    const fromFin = financeiroLookup.get(key);
    if (fromFin && isAllowedServicoNome(fromFin, catalog)) {
      return { ...event, service: displayServicoNome(fromFin, catalog) };
    }
  }

  if (service && !isAllowedServicoNome(service, catalog)) {
    return { ...event, service: 'Atendimento' };
  }
  return event;
}

export function sanitizeConsultationsForLegacy(
  events: ConsultationRecord[],
  catalog: LegacyServicoCatalog,
  financeiroLookup?: Map<string, string>,
): ConsultationRecord[] {
  return events.map((e) => sanitizeConsultationServico(e, catalog, financeiroLookup));
}

/** Serializa catálogo para API/cliente. */
export function legacyCatalogToPayload(catalog: LegacyServicoCatalog): {
  servicos: string[];
  clienteNomes: string[];
} {
  return {
    servicos: [...catalog.displayByKey.values()].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    ),
    clienteNomes: [...catalog.clientDisplayByKey.values()].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    ),
  };
}

export function legacyCatalogFromPayload(payload: {
  servicos?: string[];
  clienteNomes?: string[];
  financeiroDescricoes?: string[];
}): LegacyServicoCatalog {
  return buildLegacyServicoCatalog({
    catalogoServicos: payload.servicos,
    clienteNomes: payload.clienteNomes,
    financeiroDescricoes: payload.financeiroDescricoes,
  });
}
