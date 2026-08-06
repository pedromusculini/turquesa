import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  deleteConsultasAgenda,
  isConsultasAgendaTableMissing,
  listConsultasAgendaForOwner,
} from '@/lib/consultasAgenda';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { enqueueGoogleDelete } from '@/lib/consultasGoogleOutbox';
import { shouldDeleteGoogleEventForConsulta } from '@/lib/googleCalendarTurquesaOwned';

export const runtime = 'nodejs';

/** Lista consultas do owner (grade cross-device + status WhatsApp). */
export async function GET() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const rows = await listConsultasAgendaForOwner(email);

    const consultas = rows.map((r) => ({
      id: r.id,
      paciente: r.paciente,
      servico: r.servico,
      inicio: r.inicio,
      fim: r.fim,
      local: r.local,
      telefone: r.telefone,
      google_event_id: r.google_event_id,
      medico: r.medico,
      convenio: r.convenio,
      status: r.status,
      lembretes_whatsapp: r.lembretes_whatsapp,
      cliente_drive_id: r.cliente_drive_id ?? null,
      observacoes: r.observacoes ?? null,
    }));

    return NextResponse.json({ consultas });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json({ consultas: [] });
    }
    return NextResponse.json(
      { error: e.message ?? 'Erro ao listar atendimentos' },
      { status: 500 },
    );
  }
}

/** Remove atendimentos do Supabase (por id e/ou google_event_id). */
export async function DELETE(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  const googleEventIds = Array.isArray(body.googleEventIds)
    ? body.googleEventIds.map(String).filter(Boolean)
    : [];
  const tombstoneGoogleEventIds = Array.isArray(body.tombstoneGoogleEventIds)
    ? body.tombstoneGoogleEventIds.map(String).filter(Boolean)
    : [];

  if (ids.length === 0 && googleEventIds.length === 0) {
    return NextResponse.json({ error: 'Informe ids ou googleEventIds.' }, { status: 400 });
  }

  try {
    // Captura os eventos Google afetados antes do soft-delete para enfileirar a
    // remoção no Google (outbox durável).
    const owner = email.toLowerCase().trim();
    let affected: {
      id: string;
      google_event_id: string | null;
      google_profissional_id: string | null;
      paciente: string | null;
      telefone: string | null;
      observacoes: string | null;
    }[] = [];
    try {
      const orParts: string[] = [];
      if (ids.length) orParts.push(`id.in.(${ids.join(',')})`);
      if (googleEventIds.length) {
        orParts.push(`google_event_id.in.(${googleEventIds.join(',')})`);
      }
      if (orParts.length) {
        const { data } = await supabaseAdmin
          .from('consultas_agenda')
          .select(
            'id, google_event_id, google_profissional_id, paciente, telefone, observacoes',
          )
          .eq('owner_email', owner)
          .or(orParts.join(','));
        affected = (data ?? []) as typeof affected;
      }
    } catch {
      /* melhor esforço — não bloqueia exclusão */
    }

    const result = await deleteConsultasAgenda(email, {
      ids,
      googleEventIds,
      tombstoneGoogleEventIds,
    });

    for (const row of affected) {
      if (
        row.google_event_id &&
        shouldDeleteGoogleEventForConsulta({
          paciente: row.paciente,
          telefone: row.telefone,
          observacoes: row.observacoes,
        })
      ) {
        await enqueueGoogleDelete(
          email,
          row.id,
          row.google_event_id,
          row.google_profissional_id ?? null,
        ).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json({ success: true, deleted: 0 });
    }
    return NextResponse.json(
      { error: e.message ?? 'Erro ao excluir atendimentos' },
      { status: 500 },
    );
  }
}
