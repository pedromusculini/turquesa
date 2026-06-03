import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  generateSlugBase,
  getAgendarPublicUrl,
  getSlugByOwner,
} from '@/lib/agendamento';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const slugRow = await getSlugByOwner(email);
  if (!slugRow) {
    return NextResponse.json({ slug: null, url: null });
  }
  return NextResponse.json({
    slug: slugRow.slug,
    nome_exibicao: slugRow.nome_exibicao,
    ativo: slugRow.ativo,
    url: getAgendarPublicUrl(slugRow.slug),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const owner = email.toLowerCase().trim();

  const body = await req.json().catch(() => ({}));
  const existing = await getSlugByOwner(email);

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('clinic_name, full_name, user_type')
    .eq('email', owner)
    .maybeSingle();

  const nomeExibicao =
    body.nome_exibicao?.trim() ||
    profile?.clinic_name ||
    profile?.full_name ||
    'Agendamento';

  let slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) {
    slug = existing?.slug || generateSlugBase(nomeExibicao);
  }

  const { data, error } = await supabaseAdmin
    .from('agendamento_slugs')
    .upsert(
      {
        owner_email: owner,
        slug,
        nome_exibicao: nomeExibicao,
        ativo: body.ativo !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_email' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    slug: data.slug,
    nome_exibicao: data.nome_exibicao,
    url: getAgendarPublicUrl(data.slug),
  });
}
