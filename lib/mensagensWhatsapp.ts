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
  link_curto?: string;
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
  '{{link_curto}}',
  '{{link_calendario}}',
  '{{link_maps}}',
  '{{link_calendario_curto}}',
  '{{link_maps_curto}}',
] as const;

export const DEFAULT_MENSAGENS: MensagensWhatsappConfig = {
  convite_agendamento: `Olá, {{nome}}!

Você pode agendar sua sessão pelo link abaixo:
{{link_curto}}

📍 {{local}}
🗺 Como chegar:
{{link_maps_curto}}

Qualquer dúvida, responda por aqui.`,
  lembrete_7_dias: `Olá, {{nome}}!

Lembrete: sua sessão é em {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar:
{{link_maps_curto}}

Adicionar à sua agenda:
{{link_calendario_curto}}`,
  lembrete_1_dia: `Olá, {{nome}}!

Lembrete: amanhã é sua sessão
📅 {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar:
{{link_maps_curto}}

Adicionar à sua agenda:
{{link_calendario_curto}}

Até lá!`,
  confirmacao_apos_agendar: `Olá, {{nome}}!

Sua sessão foi reservada:
📅 {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar:
{{link_maps_curto}}

Adicionar à sua agenda:
{{link_calendario_curto}}`,
};

const LEGACY_EMOJI_FIXES: [RegExp, string][] = [
  [/🗺️/g, '🗺'],
  [/ðŸ—ºï¸/g, '🗺'],
  [/ðŸ—º/g, '🗺'],
  [/ðŸ"…/g, '📅'],
  [/ðŸ'¤/g, '👤'],
  [/ðŸ"§/g, '📍'],
  [/\uFFFD/g, ''],
];

/** Copy médico ou formato compacto salvo antes do rebrand salão. */
const LEGACY_COPY_PATTERNS: RegExp[] = [
  /Local:\s*\{\{local\}\}/i,
  /\bconsulta\b/i,
  /\bpaciente\b/i,
  /\bcl[ií]nica\b/i,
  /Sua sessão foi reservada\s+para\b/i,
  /reservada:\s*\{\{data\}\}/i,
  /Como chegar:\s*\{\{link_maps/,
  /Adicionar à sua agenda:\s*\{\{link_calendario\}\}/,
];

/** Blocos que devem ficar em linhas separadas (formato compacto no banco). */
const COMPACT_LINE_PATTERNS: RegExp[] = [
  /\{\{medico\}\}[^\n]*\{\{local\}\}/,
  /\{\{local\}\}[^\n]*Como chegar:/i,
  /Como chegar:[^\n]*Adicionar à sua agenda:/i,
];

function sanitizeTemplateText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function fixEmojiEncoding(text: string): string {
  let out = text;
  for (const [pattern, replacement] of LEGACY_EMOJI_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Detecta templates do formato antigo (copy médico, mojibake, blocos compactos). */
function isLegacyMensagemTemplate(_tipo: MensagemTipo, template: string): boolean {
  const t = template.trim();
  if (!t) return true;
  if (LEGACY_COPY_PATTERNS.some((re) => re.test(t))) return true;
  if (LEGACY_EMOJI_FIXES.some(([pattern]) => pattern.test(t))) return true;
  if (COMPACT_LINE_PATTERNS.some((re) => re.test(t))) return true;
  return false;
}

/** Atualiza placeholders e emojis sem substituir o texto personalizado. */
function applyTemplateUpgrades(tipo: MensagemTipo, template: string): string {
  let out = fixEmojiEncoding(sanitizeTemplateText(template));
  if (!out) return out;

  out = out
    .replace(/\{\{link_maps\}\}/g, '{{link_maps_curto}}')
    .replace(/\{\{link_calendario\}\}/g, '{{link_calendario_curto}}');

  if (tipo === 'convite_agendamento' && out.includes('{{link}}') && !out.includes('{{link_curto}}')) {
    out = out.replace(/\{\{link\}\}/g, '{{link_curto}}');
  }

  return out;
}

/** Normaliza templates salvos no banco para o formato legível atual. */
export function normalizeMensagemTemplate(tipo: MensagemTipo, template: string): string {
  const trimmed = sanitizeTemplateText(template);
  if (!trimmed) {
    return DEFAULT_MENSAGENS[tipo];
  }
  if (isLegacyMensagemTemplate(tipo, trimmed)) {
    return DEFAULT_MENSAGENS[tipo];
  }
  return applyTemplateUpgrades(tipo, trimmed);
}

/** Full config from stored partials or API payload; never returns undefined keys. */
export function resolveMensagensConfig(
  stored?: Partial<MensagensWhatsappConfig> | null,
): MensagensWhatsappConfig {
  return {
    convite_agendamento: normalizeMensagemTemplate(
      'convite_agendamento',
      stored?.convite_agendamento || DEFAULT_MENSAGENS.convite_agendamento,
    ),
    lembrete_7_dias: normalizeMensagemTemplate(
      'lembrete_7_dias',
      stored?.lembrete_7_dias || DEFAULT_MENSAGENS.lembrete_7_dias,
    ),
    lembrete_1_dia: normalizeMensagemTemplate(
      'lembrete_1_dia',
      stored?.lembrete_1_dia || DEFAULT_MENSAGENS.lembrete_1_dia,
    ),
    confirmacao_apos_agendar: normalizeMensagemTemplate(
      'confirmacao_apos_agendar',
      stored?.confirmacao_apos_agendar || DEFAULT_MENSAGENS.confirmacao_apos_agendar,
    ),
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

const MAPS_APPEND_PREFIX = '🗺 Como chegar:\n';
const CALENDAR_APPEND_PREFIX = 'Adicionar à sua agenda:\n';

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
  if (vars.link?.trim() && !vars.link_curto?.trim()) {
    out.link_curto = safeShortUrl(vars.link, 'generic');
  }
  if (vars.link_maps?.trim() && !vars.link_maps_curto?.trim()) {
    out.link_maps_curto = safeShortUrl(vars.link_maps, 'maps');
  }
  if (vars.link_calendario?.trim() && !vars.link_calendario_curto?.trim()) {
    out.link_calendario_curto = safeShortUrl(vars.link_calendario, 'calendario');
  }
  return out;
}

export function renderMensagem(
  template: string,
  vars: MensagemVars,
  tipo?: MensagemTipo,
): string {
  const tplBase = tipo ? normalizeMensagemTemplate(tipo, template) : template;
  const enriched = enrichMensagemVarsWithShortLinks(vars);

  const linkCurto =
    enriched.link_curto?.trim() ||
    (enriched.link?.trim() ? safeShortUrl(enriched.link, 'generic') : '');
  const linkMapsCurto =
    enriched.link_maps_curto?.trim() ||
    (enriched.link_maps?.trim() ? safeShortUrl(enriched.link_maps, 'maps') : '');
  const linkCalCurto =
    enriched.link_calendario_curto?.trim() ||
    (enriched.link_calendario?.trim()
      ? safeShortUrl(enriched.link_calendario, 'calendario')
      : '');

  const map: Record<string, string> = {
    nome: enriched.nome ?? '',
    data: enriched.data ?? '',
    hora: enriched.hora ?? '',
    medico: enriched.medico ?? '',
    local: enriched.local ?? '',
    clinica: enriched.clinica ?? '',
    link: linkCurto || (enriched.link ?? ''),
    link_curto: linkCurto || (enriched.link ?? ''),
    link_calendario: linkCalCurto || (enriched.link_calendario ?? ''),
    link_maps: linkMapsCurto || (enriched.link_maps ?? ''),
    link_calendario_curto: linkCalCurto,
    link_maps_curto: linkMapsCurto,
  };

  let tpl = omitEmptyOptionalLines(tplBase, enriched);
  let out = tpl;
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }

  const linkMaps = linkMapsCurto || enriched.link_maps?.trim() || '';
  const linkCal = linkCalCurto || enriched.link_calendario?.trim() || '';
  const hasMapsPlaceholder =
    tplBase.includes('{{link_maps}}') || tplBase.includes('{{link_maps_curto}}');
  const hasCalPlaceholder =
    tplBase.includes('{{link_calendario}}') ||
    tplBase.includes('{{link_calendario_curto}}');

  if (linkMaps && !hasMapsPlaceholder) {
    out = `${out.trim()}\n\n${MAPS_APPEND_PREFIX}${linkMaps}`;
  }
  if (linkCal && !hasCalPlaceholder && tipo !== 'convite_agendamento') {
    out = `${out.trim()}\n\n${CALENDAR_APPEND_PREFIX}${linkCal}`;
  }

  return out.replace(/\n{3,}/g, '\n\n').trim();
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

function storedTemplatesNeedMigration(stored: Record<string, unknown>): boolean {
  return (Object.keys(DEFAULT_MENSAGENS) as MensagemTipo[]).some((tipo) => {
    const raw = stored[tipo];
    if (typeof raw !== 'string' || !raw.trim()) return false;
    const sanitized = sanitizeTemplateText(raw);
    if (isLegacyMensagemTemplate(tipo, sanitized)) {
      return DEFAULT_MENSAGENS[tipo] !== sanitized;
    }
    return applyTemplateUpgrades(tipo, sanitized) !== sanitized;
  });
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

  const normalized = resolveMensagensConfig(data);
  if (storedTemplatesNeedMigration(data)) {
    const now = new Date().toISOString();
    const { error: migrateError } = await supabaseAdmin.from('mensagens_whatsapp_config').upsert(
      {
        owner_email: owner,
        convite_agendamento: normalized.convite_agendamento,
        lembrete_7_dias: normalized.lembrete_7_dias,
        lembrete_1_dia: normalized.lembrete_1_dia,
        confirmacao_apos_agendar: normalized.confirmacao_apos_agendar,
        updated_at: now,
      },
      { onConflict: 'owner_email' },
    );
    if (migrateError) {
      console.warn('[getMensagensConfig] falha ao migrar templates legados:', migrateError.message);
    }
  }

  return normalized;
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
  return renderMensagem(config[tipo], vars, tipo);
}

export function getTemplateByTipo(
  config: MensagensWhatsappConfig,
  tipo: MensagemTipo,
): string {
  return config[DB_COLUMN[tipo] as MensagemTipo] ?? DEFAULT_MENSAGENS[tipo];
}
