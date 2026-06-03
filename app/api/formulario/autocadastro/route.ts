import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { criarFormularioLink, supabaseSchemaErrorResponse } from '@/lib/formularioLinks';
import { supabaseAdmin } from '@/lib/supabaseClient';

/** GET — link de autocadastro ativo + respostas pendentes */
export async function GET() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const { data: link } = await supabaseAdmin
    .from('formulario_links')
    .select('*')
    .eq('owner_email', email)
    .is('cliente_drive_id', null)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let pendentes = 0;
  if (link?.token) {
    const { count } = await supabaseAdmin
      .from('formulario_respostas')
      .select('id', { count: 'exact', head: true })
      .eq('token', link.token)
      .eq('sincronizado_drive', false);
    pendentes = count ?? 0;
  }

  if (!link) {
    return NextResponse.json({ link: null, pendentes: 0 });
  }

  return NextResponse.json({
    link: `${baseUrl}/f/${link.token}`,
    token: link.token,
    titulo: link.titulo,
    mensagem_whatsapp: link.mensagem_whatsapp,
    pendentes,
    formulario: link,
  });
}

/** POST — gera novo link de autocadastro (sem cliente pré-cadastrado) */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));

  try {
    const result = await criarFormularioLink({
      ownerEmail: email,
      tipo: 'autocadastro',
      clienteDriveId: null,
      titulo: body.titulo || 'Cadastre-se na clínica',
      nomeClinica: body.nomeClinica,
      mensagemWhatsapp: body.mensagem_whatsapp,
      expiresAt: body.expires_at ?? null,
      telefoneDestino: body.telefone_destino ?? null,
    });

    return NextResponse.json({
      ...result,
      tipo: 'autocadastro',
      whatsapp_business: process.env.WHATSAPP_TOKEN ? 'ativo' : 'configurar',
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('[formulario/autocadastro]', err);
    const mapped = supabaseSchemaErrorResponse(err);
    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status },
    );
  }
}
