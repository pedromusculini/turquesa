import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  isConsultasAgendaTableMissing,
  upsertConsultasAgenda,
  type ConsultaSyncInput,
} from '@/lib/consultasAgenda';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body.consultas) ? body.consultas : [];

  const consultas: ConsultaSyncInput[] = raw
    .map((c: Record<string, unknown>) => {
      const start = c.start ?? c.inicio;
      const end = c.end ?? c.fim;
      if (!start) return null;
      return {
        id: String(c.id ?? ''),
        paciente: String(c.patient ?? c.paciente ?? '').trim(),
        servico: String(c.service ?? c.servico ?? 'Consulta'),
        telefone: c.telefone ? String(c.telefone) : null,
        inicio: typeof start === 'string' ? start : new Date(String(start)).toISOString(),
        fim: end
          ? typeof end === 'string'
            ? end
            : new Date(String(end)).toISOString()
          : null,
        local: c.location ? String(c.location) : c.local ? String(c.local) : null,
        google_event_id: c.googleEventId
          ? String(c.googleEventId)
          : c.google_event_id
            ? String(c.google_event_id)
            : null,
        medico: c.medico ? String(c.medico) : null,
        convenio: c.convenio ? String(c.convenio) : null,
        status: (c.status as ConsultaSyncInput['status']) ?? 'agendado',
        lembretes_whatsapp: c.lembretes_whatsapp !== false && c.lembretesWhatsapp !== false,
      };
    })
    .filter(Boolean) as ConsultaSyncInput[];

  try {
    const result = await upsertConsultasAgenda(email, consultas);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json(
        { error: 'Execute sql/consultas_whatsapp_schema.sql no Supabase.' },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : 'Erro ao sincronizar consultas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
