import { NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isConsultasAgendaTableMissing } from '@/lib/consultasAgenda';

export const runtime = 'nodejs';

/** Lista consultas do owner (status atualizados via WhatsApp). */
export async function GET() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, status, inicio, paciente, telefone, lembretes_whatsapp')
    .eq('owner_email', email.toLowerCase().trim())
    .gte('inicio', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('inicio', { ascending: true });

  if (error) {
    if (isConsultasAgendaTableMissing(error)) {
      return NextResponse.json({ consultas: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consultas: data ?? [] });
}
