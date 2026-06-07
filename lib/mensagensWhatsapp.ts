import { supabaseAdmin } from '@/lib/supabaseClient';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { createShortRedirectUrl, previewShortRedirectUrl } from '@/lib/shortLink';

export type MensagemTipo =
  | 'convite_agendamento'
  | 'lembrete_7_dias'
  | 'lembrete_1_dia'
  | 'confirmacao_apos_agendar';

export type MensagensWhatsappConfig = Record<MensagemTipo, string>;

export type MensagemVars = {
  nome?: string;
  data?: string;
  hora?: string;
  medico?: string;
  local?: string;
  clinica?: string;
  link?: string;
  link_calendario?: string;
  link_maps?: string;
  link_calendario_curto?: string;
  link_maps_curto?: string;
};

const DB_COLUMN: Record<MensagemTipo, keyof MensagensWhatsappConfig & string> = {
  convite_agendamento: 'convite_agendamento',
  lembrete_7_dias: 'lembrete_7_dias',
  lembrete_1_dia: 'lembrete_1_dia',
  confirmacao_apos_agendar: 'confirmacao_apos_agendar',
};

export const MENSAGEM_PLACEHOLDERS = [
  '{{nome}}',
  '{{data}}',
  '{{hora}}',
  '{{medico}}',
  '{{local}}',
  '{{clinica}}',
  '{{link}}',
  '{{link_calendario}}',
  '{{link_maps}}',
  '{{link_calendario_curto}}',
  '{{link_maps_curto}}',
] as const;

export const DEFAULT_MENSAGENS: MensagensWhatsappConfig = {
  convite_agendamento: `Olá, {{nome}}!

Você pode agendar sua sessão pelo link abaixo:
{{link}}

📍 {{local}}
🗺 Como chegar: {{link_maps_curto}}

Qualquer dúvida, responda por aqui.`,
  lembrete_7_dias: `Olá, {{nome}}!

Lembrete: sua sessão é em {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar: {{link_maps_curto}}

Adicionar à sua agenda:
{{link_calendario_curto}}`,
  lembrete_1_dia: `Olá, {{nome}}!

Amanhã você tem atendimento:
📅 {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar: {{link_maps_curto}}

Adicionar à sua agenda:
{{link_calendario_curto}}

Até lá!`,
  confirmacao_apos_agendar: `Olá, {{nome}}!

Sua sessão foi reservada:
📅 {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar: {{link_maps_curto}}

Adicionar à sua agenda:
{{link_calendario_curto}}`,
};

/** Full config from stored partials or API payload; never returns undefined keys. */
export function resolveMensagensConfig(
  stored?: Partial<MensagensWhatsappConfig> | null,
): MensagensWhatsappConfig {
  return {
    convite_agendamento:
      stored?.convite_agendamento || DEFAULT_MENSAGENS.convite_agendamento,
    lembrete_7_dias: stored?.lembrete_7_dias || DEFAULT_MENSAGENS.lembrete_7_dias,
    lembrete_1_dia: stored?.lembrete_1_dia || DEFAULT_MENSAGENS.lembrete_1_dia,
    confirmacao_apos_agendar:
      stored?.confirmacao_apos_agendar || DEFAULT_MENSAGENS.confirmacao_apos_agendar,
  };
}

const OPTIONAL_PLACEHOLDER_KEYS = [
  'local',
  'link_maps',
  'link_maps_curto',
  'link_calendario',
  'link_calendario_curto',
] as const;

/** Remove linhas cujo placeholder opcional está vazio (ex.: endereço incompleto). */
function omitEmptyOptionalLines(template: string, vars: MensagemVars): string {
  let out = template;
  for (const key of OPTIONAL_PLACEHOLDER_KEYS) {
    const value = vars[key];
    if (value?.trim()) continue;
    out = out.replace(new RegExp(`^[^\\n]*\\{\\{${key}\\}\\}[^\\n]*\\n?`, 'gm'), '');
  }
  return out;
}

const MAPS_APPEND_PREFIX = '🗺 Como chegar: ';

function safeShortUrl(targetUrl: string, kind: 'maps' | 'calendario' | 'generic'): string {
  if (!targetUrl.trim()) return '';
  try {
    return createShortRedirectUrl(targetUrl);
  } catch {
    return previewShortRedirectUrl(kind);
  }
}

/** Preenche links curtos a partir dos links completos (compatível com templates antigos). */
export function enrichMensagemVarsWithShortLinks(vars: MensagemVars): MensagemVars {
  const out = { ...vars };
  if (vars.link_maps?.trim() && !vars.link_maps_curto?.trim()) {
    out.link_maps_curto = safeShortUrl(vars.link_maps, 'maps');
  }
  if (vars.link_calendario?.trim() && !vars.link_calendario_curto?.trim()) {
    out.link_calendario_curto = safeShortUrl(vars.link_calendario, 'calendario');
  }
  return out;
}

export function renderMensagem(template: string, vars: MensagemVars): string {
  const enriched = enrichMensagemVarsWithShortLinks(vars);
  const map: Record<string, string> = {
    nome: enriched.nome ?? '',
    data: enriched.data ?? '',
    hora: enriched.hora ?? '',
    medico: enriched.medico ?? '',
    local: enriched.local ?? '',
    clinica: enriched.clinica ?? '',
    link: enriched.link ?? '',
    link_calendario: enriched.link_calendario ?? '',
    link_maps: enriched.link_maps ?? '',
    link_calendario_curto: enriched.link_calendario_curto ?? '',
    link_maps_curto: enriched.link_maps_curto ?? '',
  };

  let tpl = omitEmptyOptionalLines(template, enriched);
  let out = tpl;
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }

  const linkMaps =
    map.link_maps_curto.trim() || map.link_maps.trim();
  const hasMapsPlaceholder =
    template.includes('{{link_maps}}') || template.includes('{{link_maps_curto}}');
  if (linkMaps && !hasMapsPlaceholder) {
    out = `${out.trim()}\n\n${MAPS_APPEND_PREFIX}${linkMaps}`;
  }

  return out.trim();
}

export function formatConsultaDataHora(inicio: string): { data: string; hora: string } {
  const start = new Date(inicio);
  return {
    data: start.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }),
    hora: start.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }),
  };
}

export function getAppBaseUrl(): string {
  return process.env.NEXTAUTH_URL || CANONICAL_APP_URL;
}

export async function getMensagensConfig(ownerEmail: string): Promise<MensagensWhatsappConfig> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('mensagens_whatsapp_config')
    .select('*')
    .eq('owner_email', owner)
    .maybeSingle();

  if (error && error.code !== 'PGRST205') throw error;
  if (!data) return resolveMensagensConfig(null);

  return resolveMensagensConfig(data);
}

export async function saveMensagensConfig(
  ownerEmail: string,
  config: Partial<MensagensWhatsappConfig>,
): Promise<MensagensWhatsappConfig> {
  const owner = ownerEmail.toLowerCase().trim();
  const current = await getMensagensConfig(owner);
  const merged = { ...current, ...config };
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('mensagens_whatsapp_config').upsert(
    {
      owner_email: owner,
      convite_agendamento: merged.convite_agendamento,
      lembrete_7_dias: merged.lembrete_7_dias,
      lembrete_1_dia: merged.lembrete_1_dia,
      confirmacao_apos_agendar: merged.confirmacao_apos_agendar,
      updated_at: now,
    },
    { onConflict: 'owner_email' },
  );

  if (error) throw error;
  return merged;
}

export async function renderMensagemForOwner(
  ownerEmail: string,
  tipo: MensagemTipo,
  vars: MensagemVars,
): Promise<string> {
  const config = await getMensagensConfig(ownerEmail);
  return renderMensagem(config[tipo], vars);
}

export function getTemplateByTipo(
  config: MensagensWhatsappConfig,
  tipo: MensagemTipo,
): string {
  return config[DB_COLUMN[tipo] as MensagemTipo] ?? DEFAULT_MENSAGENS[tipo];
}
