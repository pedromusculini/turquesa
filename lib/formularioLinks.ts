import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  buildCatalogoPublicUrl,
  buildFormularioPublicUrl,
  getPublicAppBaseUrl,
} from '@/lib/publicFormLinks';
import {
  applyPublicLinkPlaceholders,
  buildAutocadastroWhatsAppMessage,
  buildCatalogoWhatsAppMessage,
  buildFormularioWhatsAppMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp';

export type FormularioLinkTipo = 'autocadastro' | 'cliente';

export async function criarFormularioLink(params: {
  ownerEmail: string;
  tipo: FormularioLinkTipo;
  clienteDriveId?: string | null;
  titulo?: string;
  nomeClinica?: string;
  nomePaciente?: string;
  mensagemWhatsapp?: string;
  expiresAt?: string | null;
  telefoneDestino?: string | null;
}) {
  const token = randomBytes(24).toString('hex');
  const baseUrl = getPublicAppBaseUrl();
  const link = buildFormularioPublicUrl(token, baseUrl);
  const link_catalogo = buildCatalogoPublicUrl(token, baseUrl);

  const titulo =
    params.titulo ||
    (params.tipo === 'autocadastro'
      ? params.nomeClinica
        ? `Cadastre-se no ${params.nomeClinica}`
        : 'Cadastre-se no salão'
      : 'Cadastro de cliente');

  const mensagemPadrao =
    params.tipo === 'autocadastro'
      ? buildAutocadastroWhatsAppMessage({ nomeClinica: params.nomeClinica, linkFormulario: link })
      : buildFormularioWhatsAppMessage({
          nomeClinica: params.nomeClinica,
          nomePaciente: params.nomePaciente,
          linkFormulario: link,
        });

  let mensagem = params.mensagemWhatsapp || mensagemPadrao;
  if (
    params.mensagemWhatsapp &&
    (params.mensagemWhatsapp.includes('{{link_formulario}}') ||
      params.mensagemWhatsapp.includes('{{link_catalogo}}'))
  ) {
    mensagem = applyPublicLinkPlaceholders(params.mensagemWhatsapp, {
      link_formulario: link,
      link_catalogo,
    });
  }

  const mensagem_whatsapp_catalogo = buildCatalogoWhatsAppMessage({
    nomeClinica: params.nomeClinica,
    linkCatalogo: link_catalogo,
  });

  if (params.tipo === 'autocadastro') {
    await supabaseAdmin
      .from('formulario_links')
      .update({ ativo: false })
      .eq('owner_email', params.ownerEmail)
      .is('cliente_drive_id', null);
  }

  const { data, error } = await supabaseAdmin
    .from('formulario_links')
    .insert({
      token,
      owner_email: params.ownerEmail,
      cliente_drive_id: params.clienteDriveId ?? null,
      titulo,
      mensagem_whatsapp: mensagem,
      ativo: true,
      expires_at: params.expiresAt ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  const whatsapp_url = params.telefoneDestino
    ? buildWhatsAppUrl(params.telefoneDestino, mensagem)
    : buildWhatsAppUrl(null, mensagem);

  return {
    link,
    link_catalogo,
    token,
    formulario: data,
    mensagem_whatsapp: mensagem,
    mensagem_whatsapp_catalogo,
    whatsapp_url,
  };
}

export function supabaseSchemaErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
    return {
      error:
        'Tabelas do Supabase não criadas. Execute sql/operacional_schema.sql',
      code: 'SUPABASE_SCHEMA_MISSING',
      status: 503,
    };
  }
  return { error: error.message || 'Erro', status: 500 };
}
