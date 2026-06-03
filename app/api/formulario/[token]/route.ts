import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  loadMedicosPublicos,
  resolveMedicoPublicoPayload,
  validateMedicoPublico,
} from '@/lib/medicosPublicos';

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { data: link, error } = await supabaseAdmin
    .from('formulario_links')
    .select('titulo, ativo, expires_at, cliente_drive_id, owner_email')
    .eq('token', token)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 404 });
  }

  if (!link.ativo) {
    return NextResponse.json({ error: 'Este formulário não está mais ativo' }, { status: 410 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
  }

  const autocadastro = !link.cliente_drive_id;
  const medicosResult = await loadMedicosPublicos(link.owner_email);

  return NextResponse.json({
    titulo: link.titulo,
    autocadastro,
    descricao: autocadastro
      ? 'Preencha seus dados para se cadastrar na clínica.'
      : 'Confirme ou atualize seus dados.',
    campos: ['nome', 'email', 'telefone', 'cpf', 'data_nascimento', 'convenio', 'motivo_consulta', 'observacoes'],
    is_clinica: medicosResult.isClinica,
    medicos: medicosResult.medicos,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { data: link, error: linkError } = await supabaseAdmin
    .from('formulario_links')
    .select('*')
    .eq('token', token)
    .single();

  if (linkError || !link || !link.ativo) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
  }

  const limit = checkRateLimit(`form-post:${token}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429 },
    );
  }

  const dados = await req.json();
  if (dados.dataConsent !== true) {
    return NextResponse.json(
      { error: 'É necessário aceitar o aviso de privacidade.' },
      { status: 400 },
    );
  }

  const nome = String(dados.nome ?? '').trim();
  if (!nome || nome.length < 2) {
    return NextResponse.json({ error: 'Informe seu nome completo' }, { status: 400 });
  }

  const medicosResult = await loadMedicosPublicos(link.owner_email);
  const medicoErr = validateMedicoPublico(
    medicosResult,
    String(dados.medico ?? ''),
  );
  if (medicoErr) {
    return NextResponse.json({ error: medicoErr }, { status: 400 });
  }
  const medicoPayload = resolveMedicoPublicoPayload(
    medicosResult,
    String(dados.medico ?? ''),
  );
  const dadosComMedico = {
    ...dados,
    ...(medicoPayload ?? {}),
  };

  const { data: resposta, error } = await supabaseAdmin
    .from('formulario_respostas')
    .insert({
      link_id: link.id,
      token,
      dados: dadosComMedico,
      origem: dados.origem === 'whatsapp' ? 'whatsapp' : 'web',
      sincronizado_drive: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Dados enviados com sucesso. Obrigado!',
  });
}
