import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { ensureGoogleEventAnamneseLink } from '@/lib/googleCalendarAnamneseBackfill';

type BackfillItem = {
  googleEventId?: string;
  clienteDriveId?: string;
  nomeCliente?: string;
  medico?: string | null;
  profissionalId?: string;
  consultaId?: string;
};

/** PATCH eventos Google existentes que têm cliente mas ainda sem link de anamnese. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: ownerEmail } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const items = (body.items ?? body.consultas) as BackfillItem[] | undefined;

    let rows: BackfillItem[] = items?.filter(Boolean) ?? [];

    if (!rows.length) {
      const consultaIds = (body.consultaIds ?? body.ids) as string[] | undefined;
      const googleEventIds = (body.googleEventIds ?? body.google_event_ids) as string[] | undefined;

      let query = supabaseAdmin
        .from('consultas_agenda')
        .select(
          'id, paciente, medico, google_event_id, cliente_drive_id',
        )
        .eq('owner_email', ownerEmail)
        .not('google_event_id', 'is', null)
        .not('cliente_drive_id', 'is', null);

      if (consultaIds?.length) {
        query = query.in('id', consultaIds);
      } else if (googleEventIds?.length) {
        query = query.in('google_event_id', googleEventIds);
      } else {
        const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('inicio', timeMin);
      }

      const { data, error } = await query.order('inicio', { ascending: true }).limit(150);
      if (error) throw error;

      rows = (data ?? []).map((r) => ({
        consultaId: r.id as string,
        googleEventId: r.google_event_id as string,
        clienteDriveId: r.cliente_drive_id as string,
        nomeCliente: r.paciente as string,
        medico: r.medico as string | null,
      }));
    }

    const results: {
      googleEventId: string;
      patched: boolean;
      skipped?: string;
      error?: string;
    }[] = [];

    for (const row of rows) {
      const googleEventId = row.googleEventId?.trim();
      const clienteDriveId = row.clienteDriveId?.trim();
      if (!googleEventId || !clienteDriveId) continue;

      try {
        const result = await ensureGoogleEventAnamneseLink({
          req,
          ownerEmail,
          googleEventId,
          clienteDriveId,
          nomeCliente: row.nomeCliente,
          medico: row.medico,
          profissionalId: row.profissionalId,
        });
        results.push({ googleEventId, ...result });
      } catch (err) {
        results.push({
          googleEventId,
          patched: false,
          error: err instanceof Error ? err.message : 'Erro ao atualizar evento',
        });
      }
    }

    const patched = results.filter((r) => r.patched).length;
    return NextResponse.json({ patched, total: results.length, results });
  } catch (error: unknown) {
    console.error('[google-calendar/backfill-anamnese]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
