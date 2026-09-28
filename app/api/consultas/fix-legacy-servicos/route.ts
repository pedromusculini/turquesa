import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  buildFinanceiroServicoLookup,
  isAllowedServicoNome,
  normalizeLegacyKey,
  resolveLegacyServico,
} from '@/lib/legacyProcedimentoCatalog';
import { loadLegacyServicoCatalogForOwner } from '@/lib/legacyProcedimentoCatalogServer';
import {
  isConsultasAgendaTableMissing,
  listConsultasAgendaForOwner,
  upsertConsultasAgenda,
} from '@/lib/consultasAgenda';
import { supabaseAdmin } from '@/lib/supabaseClient';

/** Corrige servico=cliente na agenda da conta legacy (import Marrissa). */
export async function POST() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const catalog = await loadLegacyServicoCatalogForOwner(email);
  if (!catalog) {
    return NextResponse.json({ legacy: false, fixed: 0, consultas: [] });
  }

  try {
    const [consultas, financeiroRes] = await Promise.all([
      listConsultasAgendaForOwner(email, { daysPast: 365 * 3, daysFuture: 365 }),
      supabaseAdmin
        .from('financeiro_transacoes')
        .select('data, descricao')
        .eq('owner_email', email)
        .eq('tipo', 'entrada'),
    ]);

    const financeiroLookup = buildFinanceiroServicoLookup(
      (financeiroRes.data ?? []).map((r) => ({
        data: String(r.data ?? ''),
        descricao: String(r.descricao ?? ''),
      })),
    );

    const updates: (typeof consultas)[number][] = [];

    for (const row of consultas) {
      const patient = row.paciente?.trim() ?? '';
      const current = row.servico?.trim() ?? '';
      if (!current) continue;

      // Só corrige import onde servico = nome da cliente; texto livre (ex.: "sinal pago") fica.
      const currentKey = normalizeLegacyKey(current);
      const isNomeCliente =
        (!!patient && normalizeLegacyKey(patient) === currentKey) ||
        catalog.clientBlocklist.has(currentKey);
      if (!isNomeCliente) continue;

      let next: string | null = null;
      if (financeiroLookup.size > 0 && patient && row.inicio) {
        const date = row.inicio.slice(0, 10);
        const key = `${date}|${normalizeLegacyKey(patient)}`;
        const fromFin = financeiroLookup.get(key);
        if (fromFin && isAllowedServicoNome(fromFin, catalog)) {
          next = resolveLegacyServico(fromFin, patient, catalog) ?? fromFin;
        }
      }
      next ??= 'Atendimento';

      if (next !== current) {
        updates.push({ ...row, servico: next });
      }
    }

    if (updates.length > 0) {
      await upsertConsultasAgenda(
        email,
        updates.map((u) => ({
          id: u.id,
          paciente: u.paciente,
          servico: u.servico,
          telefone: u.telefone,
          inicio: u.inicio,
          fim: u.fim,
          local: u.local,
          google_event_id: u.google_event_id,
          medico: u.medico,
          convenio: u.convenio,
          status: u.status,
          lembretes_whatsapp: u.lembretes_whatsapp,
          cliente_drive_id: u.cliente_drive_id,
          observacoes: u.observacoes,
        })),
      );
    }

    const refreshed = await listConsultasAgendaForOwner(email, {
      daysPast: 365 * 3,
      daysFuture: 365,
    });

    return NextResponse.json({
      legacy: true,
      fixed: updates.length,
      servicosNoCatalogo: catalog.allowlist.size,
      consultas: refreshed.map((r) => ({
        id: r.id,
        paciente: r.paciente,
        servico: r.servico,
        inicio: r.inicio,
        fim: r.fim,
        telefone: r.telefone,
        local: r.local,
        google_event_id: r.google_event_id,
        medico: r.medico,
        convenio: r.convenio,
        status: r.status,
        lembretes_whatsapp: r.lembretes_whatsapp,
        cliente_drive_id: r.cliente_drive_id,
      })),
    });
  } catch (error) {
    if (isConsultasAgendaTableMissing(error as { code?: string; message?: string })) {
      return NextResponse.json(
        { error: 'Tabela consultas_agenda ausente.', code: 'SCHEMA_MISSING' },
        { status: 503 },
      );
    }
    console.error('[consultas/fix-legacy-servicos]', error);
    return NextResponse.json({ error: 'Falha ao corrigir serviços legacy.' }, { status: 500 });
  }
}
