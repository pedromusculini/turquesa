import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  loadMedicosPublicos,
  resolveMedicoPublicoPayload,
  validateMedicoPublico,
} from '@/lib/medicosPublicos';
import {
  normalizeAnamneseRespostas,
  rowToAnamneseCampo,
  validateAnamneseRespostas,
  type AnamneseCampo,
} from '@/lib/anamnese';
import { cpfValidationMessage, normalizeCpf } from '@/lib/cpf';
import { brPhoneLocalDigits } from '@/lib/phoneMatch';
import { loadOwnerSalonName, tituloCadastroSalao } from '@/lib/salonDisplay';

type Params = { params: Promise<{ token: string }> };

async function loadAnamneseCampos(ownerEmail: string): Promise<AnamneseCampo[]> {
  const { data, error } = await supabaseAdmin
    .from('anamnese_campos')
    .select('*')
    .eq('owner_email', ownerEmail)
    .order('ordem', { ascending: true });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => rowToAnamneseCampo(row as Record<string, unknown>));
}

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
  const nomeSalao = await loadOwnerSalonName(link.owner_email);
  const tituloPadrao = tituloCadastroSalao(nomeSalao);
  const tituloStored = String(link.titulo ?? '').trim();
  const tituloLegado =
    tituloStored === 'Cadastre-se na clínica' ||
    tituloStored === 'Cadastro de paciente' ||
    tituloStored === 'Cadastro de cliente' ||
    tituloStored.startsWith('Cadastre-se na clínica') ||
    tituloStored.startsWith('Cadastre-se no salão');
  const titulo =
    autocadastro && (!tituloStored || tituloLegado) ? tituloPadrao : tituloStored || tituloPadrao;

  let anamnese_campos: AnamneseCampo[] = [];
  try {
    anamnese_campos = await loadAnamneseCampos(link.owner_email);
  } catch {
    anamnese_campos = [];
  }

  return NextResponse.json({
    titulo,
    nome_salao: nomeSalao,
    autocadastro,
    descricao: autocadastro
      ? `Preencha seus dados para se cadastrar no ${nomeSalao}.`
      : 'Confirme ou atualize seus dados.',
    campos: ['nome', 'email', 'telefone', 'cpf', 'data_nascimento', 'observacoes'],
    is_clinica: medicosResult.isClinica,
    medicos: medicosResult.medicos,
    anamnese_campos,
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

  const telefoneDigits = brPhoneLocalDigits(String(dados.telefone ?? ''));
  if (telefoneDigits.length < 10) {
    return NextResponse.json({ error: 'Informe um telefone válido' }, { status: 400 });
  }

  const cpfErr = cpfValidationMessage(String(dados.cpf ?? ''));
  if (cpfErr) {
    return NextResponse.json({ error: cpfErr }, { status: 400 });
  }

  if (dados.autorizacao_imagem !== true && dados.autorizacao_imagem !== false) {
    return NextResponse.json(
      { error: 'Informe se autoriza ou não o uso de imagens para divulgação' },
      { status: 400 },
    );
  }

  const medicosResult = await loadMedicosPublicos(link.owner_email);
  const medicoErr = validateMedicoPublico(medicosResult, String(dados.medico ?? ''));
  if (medicoErr) {
    return NextResponse.json({ error: medicoErr }, { status: 400 });
  }

  let anamnese_campos: AnamneseCampo[] = [];
  try {
    anamnese_campos = await loadAnamneseCampos(link.owner_email);
  } catch {
    return NextResponse.json({ error: 'Erro ao validar formulário' }, { status: 500 });
  }

  const anamneseRaw =
    dados.anamnese_respostas && typeof dados.anamnese_respostas === 'object'
      ? (dados.anamnese_respostas as Record<string, unknown>)
      : {};
  const anamneseErr = validateAnamneseRespostas(anamnese_campos, anamneseRaw);
  if (anamneseErr) {
    return NextResponse.json({ error: anamneseErr }, { status: 400 });
  }
  const anamnese_respostas = normalizeAnamneseRespostas(anamnese_campos, anamneseRaw);

  let servico_catalogo_id: string | null = null;
  const servicoId = String(dados.servico_catalogo_id ?? '').trim();
  if (servicoId) {
    const { data: servico } = await supabaseAdmin
      .from('servicos_catalogo')
      .select('id, tipo')
      .eq('id', servicoId)
      .eq('owner_email', link.owner_email)
      .eq('ativo', true)
      .maybeSingle();
    if (!servico || servico.tipo === 'produto') {
      return NextResponse.json({ error: 'Serviço selecionado inválido' }, { status: 400 });
    }
    servico_catalogo_id = servico.id;
  }

  const medicoPayload = resolveMedicoPublicoPayload(
    medicosResult,
    String(dados.medico ?? ''),
  );

  const dadosPayload: Record<string, unknown> = {
    nome,
    email: dados.email ? String(dados.email).trim() : '',
    telefone: String(dados.telefone ?? '').trim(),
    cpf: normalizeCpf(String(dados.cpf ?? '')),
    data_nascimento: dados.data_nascimento ? String(dados.data_nascimento) : '',
    observacoes: dados.observacoes ? String(dados.observacoes) : '',
    medico: dados.medico ? String(dados.medico) : '',
    autorizacao_imagem: dados.autorizacao_imagem === true,
    servico_catalogo_id,
    anamnese_respostas,
    dataConsent: true,
    ...(medicoPayload ?? {}),
  };

  const insertRow: Record<string, unknown> = {
    link_id: link.id,
    token,
    dados: dadosPayload,
    origem: dados.origem === 'whatsapp' ? 'whatsapp' : 'web',
    sincronizado_drive: false,
    servico_catalogo_id,
    autorizacao_imagem: dados.autorizacao_imagem === true,
    anamnese_respostas,
  };

  const { error } = await supabaseAdmin.from('formulario_respostas').insert(insertRow);

  if (error) {
    const missingCol =
      error.message?.includes('servico_catalogo_id') ||
      error.message?.includes('autorizacao_imagem') ||
      error.message?.includes('anamnese_respostas');
    if (missingCol) {
      const { error: fallbackErr } = await supabaseAdmin.from('formulario_respostas').insert({
        link_id: link.id,
        token,
        dados: dadosPayload,
        origem: dados.origem === 'whatsapp' ? 'whatsapp' : 'web',
        sincronizado_drive: false,
      });
      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Dados enviados com sucesso. Obrigado!',
  });
}
