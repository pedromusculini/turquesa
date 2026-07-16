import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  consultasAgendaErrorMessage,
  isConsultasAgendaTableMissing,
  upsertConsultasAgenda,
  type ConsultaSyncInput,
} from '@/lib/consultasAgenda';
import { enqueueGoogleSync } from '@/lib/consultasGoogleOutbox';

export const runtime = 'nodejs';

function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  try {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

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
      const inicio = toIsoOrNull(start);
      if (!inicio) return null;
      const googleEventInPayload =
        'googleEventId' in c || 'google_event_id' in c;
      const googleProfInPayload =
        'googleProfissionalId' in c || 'google_profissional_id' in c;
      const base: ConsultaSyncInput = {
        id: String(c.id ?? ''),
        paciente: String(c.patient ?? c.paciente ?? '').trim(),
        servico: String(c.service ?? c.servico ?? 'Atendimento'),
        telefone: c.telefone ? String(c.telefone) : null,
        inicio,
        fim: toIsoOrNull(end),
        local: c.location ? String(c.location) : c.local ? String(c.local) : null,
        medico: c.medico ? String(c.medico) : null,
        convenio: c.convenio ? String(c.convenio) : null,
        status: (c.status as ConsultaSyncInput['status']) ?? 'confirmado',
        lembretes_whatsapp: c.lembretes_whatsapp !== false && c.lembretesWhatsapp !== false,
        cliente_drive_id: c.clienteDriveId
          ? String(c.clienteDriveId)
          : c.cliente_drive_id
            ? String(c.cliente_drive_id)
            : null,
        observacoes: c.observacoes ? String(c.observacoes).trim() || null : null,
      };
      // Só grava google_event_id quando há valor. Nunca zera um link existente por
      // este caminho (evita perder o vínculo em salvamentos mid-flight). Unlink real
      // acontece via exclusão dedicada.
      if (googleEventInPayload) {
        const v = c.googleEventId ?? c.google_event_id;
        if (v != null && String(v).trim()) {
          base.google_event_id = String(v).trim();
        }
      }
      if (googleProfInPayload) {
        const v = c.googleProfissionalId ?? c.google_profissional_id;
        base.google_profissional_id =
          v != null && String(v).trim() ? String(v).trim() : null;
      }
      return base;
    })
    .filter(Boolean) as ConsultaSyncInput[];

  // Edições/criações vindas do usuário sinalizam intenção de refletir no Google.
  const enqueueGoogle = body.enqueueGoogleSync === true;

  try {
    const result = await upsertConsultasAgenda(email, consultas);

    if (enqueueGoogle && Array.isArray(result.saved)) {
      for (const saved of result.saved) {
        if (saved?.id) {
          await enqueueGoogleSync(email, saved.id).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json(
        { error: 'Execute sql/consultas_whatsapp_schema.sql no Supabase.' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: consultasAgendaErrorMessage(err) },
      { status: 500 },
    );
  }
}
