import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const { data, error } = await supabaseAdmin
    .from('agenda_disponibilidade')
    .select('*')
    .eq('owner_email', email.toLowerCase().trim())
    .order('dia_semana')
    .order('hora_inicio');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ disponibilidade: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const owner = email.toLowerCase().trim();

  const body = await req.json();
  const items = body.disponibilidade as Array<{
    medico_nome?: string | null;
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
    duracao_minutos?: number;
    ativo?: boolean;
  }>;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'disponibilidade inválida' }, { status: 400 });
  }

  await supabaseAdmin.from('agenda_disponibilidade').delete().eq('owner_email', owner);

  if (items.length > 0) {
    const rows = items.map((i) => ({
      owner_email: owner,
      medico_nome: i.medico_nome?.trim() || null,
      dia_semana: i.dia_semana,
      hora_inicio: i.hora_inicio,
      hora_fim: i.hora_fim,
      duracao_minutos: i.duracao_minutos ?? 40,
      ativo: i.ativo !== false,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from('agenda_disponibilidade').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
