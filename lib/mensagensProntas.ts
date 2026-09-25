import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  enderecoVarsFromProfile,
  getAgendarPublicUrl,
  getSlugByOwner,
  loadOwnerProfile,
} from '@/lib/agendamento';
import { ensureAutocadastroLink } from '@/lib/formularioLinks';
import { buildCatalogoPublicUrl, buildFormularioPublicUrl } from '@/lib/publicFormLinks';
import {
  enrichMensagemVarsWithShortLinks,
  getAppBaseUrl,
  getMensagensConfig,
  renderMensagem,
  type MensagemVars,
} from '@/lib/mensagensWhatsapp';
import { getSalaoLandingPath } from '@/lib/salonLanding';
import { sessoesRestantes } from '@/lib/clientePacotes';
import { buildWhatsAppUrls, type WhatsAppUrls } from '@/lib/whatsapp';
import type { ClientePacote } from '@/lib/types';

export type MensagemPronta = {
  mensagem: string;
  whatsapp: WhatsAppUrls | null;
};

function formatDataBr(iso: string): string {
  try {
    return format(parseISO(iso.slice(0, 10)), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso.slice(0, 10);
  }
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

function clinicaFromProfile(profile: Record<string, unknown> | null): string {
  return String(profile?.clinic_name ?? profile?.full_name ?? '').trim();
}

/** Lista numerada das sessões já feitas: "✅ 1ª — 01/06/2026". */
export function formatSessoesDatas(pacote: ClientePacote): string {
  return [...pacote.usos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((u, i) => `✅ ${i + 1}ª — ${formatDataBr(u.data)}`)
    .join('\n');
}

export async function buildPacoteSessaoMensagem(params: {
  ownerEmail: string;
  cliente: { nome: string; telefone?: string | null };
  pacote: ClientePacote;
  /** Data da sessão (YYYY-MM-DD). Padrão: último uso registrado. */
  dataSessao?: string;
}): Promise<MensagemPronta> {
  const owner = params.ownerEmail.toLowerCase().trim();
  const { pacote } = params;
  const [config, profile, slugRow] = await Promise.all([
    getMensagensConfig(owner),
    loadOwnerProfile(owner),
    getSlugByOwner(owner),
  ]);

  const ultimo = [...pacote.usos].sort((a, b) => a.data.localeCompare(b.data)).at(-1);
  const data = params.dataSessao ?? ultimo?.data ?? new Date().toISOString().slice(0, 10);

  const vars = enrichMensagemVarsWithShortLinks({
    nome: primeiroNome(params.cliente.nome),
    data: formatDataBr(data),
    clinica: clinicaFromProfile(profile),
    link: slugRow?.slug && sessoesRestantes(pacote) > 0 ? getAgendarPublicUrl(slugRow.slug) : '',
    pacote_nome: pacote.nome,
    sessao_numero: String(pacote.usos.length),
    sessoes_total: String(pacote.sessoes_total),
    sessoes_restantes: String(sessoesRestantes(pacote)),
    sessoes_datas: formatSessoesDatas(pacote),
  });

  const mensagem = renderMensagem(config.pacote_sessao, vars, 'pacote_sessao');
  const telefone = params.cliente.telefone?.replace(/\D/g, '');
  return {
    mensagem,
    whatsapp: telefone ? buildWhatsAppUrls(telefone, mensagem) : null,
  };
}

/** Links reais do salão para a mensagem de boas-vindas. */
export async function loadBoasVindasVars(ownerEmail: string): Promise<MensagemVars> {
  const owner = ownerEmail.toLowerCase().trim();
  const [profile, slugRow] = await Promise.all([loadOwnerProfile(owner), getSlugByOwner(owner)]);
  const clinica = clinicaFromProfile(profile);

  let linkCadastro = '';
  let linkCatalogo = '';
  try {
    const form = await ensureAutocadastroLink(owner, clinica || undefined);
    if (form?.token) {
      linkCadastro = buildFormularioPublicUrl(form.token);
      linkCatalogo = buildCatalogoPublicUrl(form.token);
    }
  } catch (err) {
    console.warn('[boas-vindas] autocadastro indisponível', err);
  }

  const slug = slugRow?.slug as string | undefined;
  const endereco = enderecoVarsFromProfile(profile);
  return enrichMensagemVarsWithShortLinks({
    clinica,
    link: slug ? getAgendarPublicUrl(slug) : '',
    link_site: slug ? `${getAppBaseUrl()}${getSalaoLandingPath(slug)}` : '',
    link_cadastro: linkCadastro,
    link_catalogo: linkCatalogo,
    local: endereco.local,
    link_maps: endereco.link_maps,
  });
}

export async function buildBoasVindasMensagem(
  ownerEmail: string,
  templateOverride?: string,
): Promise<{ mensagem: string; vars: MensagemVars }> {
  const owner = ownerEmail.toLowerCase().trim();
  const [config, vars] = await Promise.all([
    templateOverride ? null : getMensagensConfig(owner),
    loadBoasVindasVars(owner),
  ]);
  const template = templateOverride ?? config!.boas_vindas;
  return { mensagem: renderMensagem(template, vars, 'boas_vindas'), vars };
}
