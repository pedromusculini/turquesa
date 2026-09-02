import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAgendarPublicUrl, getSlugByOwner, loadOwnerProfile, enderecoVarsFromProfile } from '@/lib/agendamento';
import { loadClientesStore } from '@/lib/clientesDrive';
import {
  diasDesdeUltimaSessao,
  lastSessaoRealizadaCliente,
  loadClientesCrmExternoContext,
} from '@/lib/clientesCrmLastSessao';
import { buildSemRetornoListaWithDias } from '@/lib/clientesCrmSegments';
import {
  enrichMensagemVarsWithShortLinks,
  getMensagensConfig,
  renderMensagem,
} from '@/lib/mensagensWhatsapp';
import { getResgateSettings } from '@/lib/resgateSettings';
import { buildWhatsAppUrls } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabaseClient';

export type ResgatePendenteItem = {
  id: string;
  nome: string;
  telefone: string;
  dias_sem_retorno: number;
  ultima_sessao: string;
  mensagem: string;
  enviado: boolean;
  whatsapp_url: string | null;
  whatsapp_app_url: string | null;
  whatsapp_android_url: string | null;
};

function formatDataCurta(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso.slice(0, 10);
  }
}

async function loadResgateStatusMap(owner: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabaseAdmin
    .from('whatsapp_resgate_enviado')
    .select('cliente_drive_id, status')
    .eq('owner_email', owner);

  if (error) {
    if (error.code === 'PGRST205') return map;
    throw error;
  }
  for (const row of data ?? []) {
    map.set(row.cliente_drive_id as string, row.status as string);
  }
  return map;
}

export type ResgateMensagemContexto = 'sem_retorno' | 'primeira_visita';

function countAtendimentosRealizados(cliente: {
  atendimentos?: { status: string }[] | null;
}): number {
  return (cliente.atendimentos ?? []).filter((a) => a.status === 'realizado').length;
}

export async function buildResgateMensagemForCliente(params: {
  ownerEmail: string;
  accessToken: string;
  clienteId: string;
  diasLimite?: number;
  contexto?: ResgateMensagemContexto;
}): Promise<{ mensagem: string; whatsapp: ReturnType<typeof buildWhatsAppUrls> | null } | null> {
  const owner = params.ownerEmail.toLowerCase().trim();
  const store = await loadClientesStore(params.accessToken, owner);
  const ref = new Date();
  const { agendaUltimaSessao, agendamentoFuturo } = await loadClientesCrmExternoContext(
    owner,
    store,
    ref,
  );
  const cliente = store.clientes.find((c) => c.id === params.clienteId);
  if (!cliente?.telefone?.replace(/\D/g, '')) return null;

  const settings = await getResgateSettings(owner);
  const diasLimite = params.diasLimite ?? settings.resgate_dias_limite;
  const contexto = params.contexto ?? 'sem_retorno';

  let diasSemRetorno: number;
  let ultimoIso: string;

  if (contexto === 'primeira_visita') {
    if (countAtendimentosRealizados(cliente) !== 1) return null;
    if (agendamentoFuturo.has(cliente.id)) return null;
    const ultimo = lastSessaoRealizadaCliente(cliente, agendaUltimaSessao);
    if (!ultimo) return null;
    diasSemRetorno = diasDesdeUltimaSessao(ref, ultimo);
    ultimoIso = ultimo.toISOString();
  } else {
    const lista = buildSemRetornoListaWithDias(
      store,
      ref,
      diasLimite,
      agendaUltimaSessao,
      agendamentoFuturo,
    );
    const item = lista.find((c) => c.id === params.clienteId);
    if (!item) return null;
    diasSemRetorno = item.dias_sem_retorno;
    ultimoIso = item.ultimo_atendimento;
  }

  const [config, profile, slugRow] = await Promise.all([
    getMensagensConfig(owner),
    loadOwnerProfile(owner),
    getSlugByOwner(owner),
  ]);
  const endereco = enderecoVarsFromProfile(profile);
  const link = slugRow?.slug ? getAgendarPublicUrl(slugRow.slug) : '';
  const vars = enrichMensagemVarsWithShortLinks({
    nome: cliente.nome,
    clinica: String(profile?.clinic_name ?? profile?.full_name ?? '').trim(),
    local: endereco.local,
    link,
    link_maps: endereco.link_maps,
    dias_sem_retorno: String(diasSemRetorno),
    ultima_sessao: formatDataCurta(ultimoIso),
  });
  const mensagem = renderMensagem(config.resgate_cliente, vars, 'resgate_cliente');
  const whatsapp = buildWhatsAppUrls(cliente.telefone, mensagem);
  return { mensagem, whatsapp };
}

export async function buildResgatePendentesResponse(
  ownerEmail: string,
  accessToken: string,
): Promise<{
  ativo: boolean;
  dias_limite: number;
  resgates: ResgatePendenteItem[];
}> {
  const owner = ownerEmail.toLowerCase().trim();
  const settings = await getResgateSettings(owner);
  if (!settings.resgate_cliente_ativo) {
    return { ativo: false, dias_limite: settings.resgate_dias_limite, resgates: [] };
  }

  const store = await loadClientesStore(accessToken, owner);
  const { agendaUltimaSessao, agendamentoFuturo } = await loadClientesCrmExternoContext(
    owner,
    store,
  );
  const lista = buildSemRetornoListaWithDias(
    store,
    new Date(),
    settings.resgate_dias_limite,
    agendaUltimaSessao,
    agendamentoFuturo,
  );
  const comTelefone = lista.filter((c) => c.telefone?.replace(/\D/g, ''));
  comTelefone.sort((a, b) => b.dias_sem_retorno - a.dias_sem_retorno);

  const [config, profile, slugRow, statusMap] = await Promise.all([
    getMensagensConfig(owner),
    loadOwnerProfile(owner),
    getSlugByOwner(owner),
    loadResgateStatusMap(owner),
  ]);
  const endereco = enderecoVarsFromProfile(profile);
  const link = slugRow?.slug ? getAgendarPublicUrl(slugRow.slug) : '';
  const clinica = String(profile?.clinic_name ?? profile?.full_name ?? '').trim();

  const resgates: ResgatePendenteItem[] = [];
  for (const item of comTelefone) {
    if (statusMap.get(item.id) === 'removido') continue;
    const vars = enrichMensagemVarsWithShortLinks({
      nome: item.nome,
      clinica,
      local: endereco.local,
      link,
      link_maps: endereco.link_maps,
      dias_sem_retorno: String(item.dias_sem_retorno),
      ultima_sessao: formatDataCurta(item.ultimo_atendimento),
    });
    const mensagem = renderMensagem(config.resgate_cliente, vars, 'resgate_cliente');
    const urls = buildWhatsAppUrls(item.telefone!, mensagem);
    resgates.push({
      id: item.id,
      nome: item.nome,
      telefone: item.telefone!,
      dias_sem_retorno: item.dias_sem_retorno,
      ultima_sessao: formatDataCurta(item.ultimo_atendimento),
      mensagem,
      enviado: statusMap.get(item.id) === 'enviado',
      whatsapp_url: urls.web,
      whatsapp_app_url: urls.app,
      whatsapp_android_url: urls.android,
    });
  }

  return {
    ativo: true,
    dias_limite: settings.resgate_dias_limite,
    resgates,
  };
}

export async function markResgateStatus(
  ownerEmail: string,
  clienteDriveId: string,
  status: 'enviado' | 'removido',
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  const { error } = await supabaseAdmin.from('whatsapp_resgate_enviado').upsert(
    {
      owner_email: owner,
      cliente_drive_id: clienteDriveId,
      status,
      enviado_em: new Date().toISOString(),
    },
    { onConflict: 'owner_email,cliente_drive_id' },
  );
  if (error && error.code !== 'PGRST205') throw error;
}
