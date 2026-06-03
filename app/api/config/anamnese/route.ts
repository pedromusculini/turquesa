import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  rowToAnamneseCampo,
  sanitizeAnamneseCampoInput,
  type AnamneseCampo,
} from '@/lib/anamnese';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage, supabaseErrorStatus } from '@/lib/supabaseErrors';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const { data, error } = await supabaseAdmin
    .from('anamnese_campos')
    .select('*')
    .eq('owner_email', email)
    .order('ordem', { ascending: true });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return NextResponse.json(
        {
          error: 'Execute npm run db:anamnese no Supabase.',
          code: 'SUPABASE_SCHEMA_MISSING',
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar anamnese') },
      { status: supabaseErrorStatus(error) },
    );
  }

  const campos: AnamneseCampo[] = (data ?? []).map((row) =>
    rowToAnamneseCampo(row as Record<string, unknown>),
  );

  return NextResponse.json({ campos });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const rawList = Array.isArray(body.campos) ? body.campos : [];
  const inputs = rawList
    .map((item: unknown, i: number) => sanitizeAnamneseCampoInput(item, i))
    .filter(Boolean) as NonNullable<ReturnType<typeof sanitizeAnamneseCampoInput>>[];

  if (inputs.length > 30) {
    return NextResponse.json({ error: 'Máximo de 30 campos' }, { status: 400 });
  }

  const { error: delError } = await supabaseAdmin
    .from('anamnese_campos')
    .delete()
    .eq('owner_email', email);

  if (delError) {
    if (delError.code === 'PGRST205' || delError.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Execute npm run db:anamnese no Supabase.', code: 'SUPABASE_SCHEMA_MISSING' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: supabaseErrorMessage(delError, 'Erro ao salvar') },
      { status: supabaseErrorStatus(delError) },
    );
  }

  if (inputs.length === 0) {
    return NextResponse.json({ campos: [] });
  }

  const rows = inputs.map((c, i) => ({
    owner_email: email,
    ordem: c.ordem ?? i,
    label: c.label,
    tipo: c.tipo,
    opcoes: c.tipo === 'opcoes' ? c.opcoes ?? [] : [],
    obrigatorio: !!c.obrigatorio,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from('anamnese_campos')
    .insert(rows)
    .select('*');

  if (error) {
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao salvar campos') },
      { status: supabaseErrorStatus(error) },
    );
  }

  const campos: AnamneseCampo[] = (data ?? []).map((row) =>
    rowToAnamneseCampo(row as Record<string, unknown>),
  );

  return NextResponse.json({ campos });
}
