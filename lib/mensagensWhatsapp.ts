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

Adicionar à sua agenda:
{{link_calendario_curto}}`,
  lembrete_1_dia: `Olá, {{nome}}!

Lembrete: amanhã é sua sessão
📅 {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar:
{{link_maps_curto}}

Até lá!`,
  confirmacao_apos_agendar: `Olá, {{nome}}!

Sua sessão foi reservada:
📅 {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}

Adicionar à sua agenda:
{{link_calendario_curto}}`,
};

const LEGACY_EMOJI_FIXES: [RegExp, string][] = [
  [/🗺️/g, '🗺'],
  [/📍️/g, '📍'],
  [/📅️/g, '📅'],
  [/👤️/g, '👤'],
  [/ðŸ—ºï¸/g, '🗺'],
  [/ðŸ—º/g, '🗺'],
  [/ðŸ—/g, '🗺'],
  [/ðŸ"…/g, '📅'],
  [/ðŸ"§/g, '📍'],
  [/ðŸ'¤/g, '👤'],
  [/Ã°Å¸â€œâ€¦/g, '📅'],
  [/Ã°Å¸â€œÂ§/g, '📍'],
  [/Ã°Å¸â€˜Â¤/g, '👤'],
  [/Ã°Å¸â€”Âº/g, '🗺'],
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
  /** Formato antigo com link Maps longo — não confundir com {{link_maps_curto}} do padrão atual. */
  /Como chegar:\s*\{\{link_maps\}\}/,
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

/** Confirmação WA legada: compacta, sem agenda, ou ainda com bloco Maps (8ca4f13). */
function isLegacyConfirmacaoTemplate(template: string): boolean {
  const t = template.trim();
  if (!t) return true;
  if (/Como chegar:/i.test(t) || /\{\{link_maps/i.test(t)) return true;
  if (!/Adicionar à sua agenda:/i.test(t) && !/\{\{link_calendario/i.test(t)) return true;
  if (LEGACY_COPY_PATTERNS.some((re) => re.test(t))) return true;
  if (COMPACT_LINE_PATTERNS.some((re) => re.test(t))) return true;
  const nonEmptyLines = t.split('\n').filter((line) => line.trim()).length;
  if (nonEmptyLines < 5) return true;
  if (/reservada:[^\n]{0,120}\{\{data\}\}/i.test(t)) return true;
  if (/Olá[^\n]{0,200}Sua sessão foi reservada:/i.test(t.replace(/\n/g, ''))) return true;
  return false;
}

/** Detecta templates do formato antigo (copy médico, mojibake, blocos compactos). */
function isLegacyMensagemTemplate(tipo: MensagemTipo, template: string): boolean {
  const t = template.trim();
  if (!t) return true;
  if (tipo === 'confirmacao_apos_agendar') {
    return isLegacyConfirmacaoTemplate(t);
  }
  if (LEGACY_COPY_PATTERNS.some((re) => re.test(t))) return true;
  if (LEGACY_EMOJI_FIXES.some(([pattern]) => pattern.test(t))) return true;
  if (COMPACT_LINE_PATTERNS.some((re) => re.test(t))) return true;
  return false;
}

/** Atualiza placeholders e emojis sem substituir o texto personalizado. */
export function prepareMensagemForSave(tipo: MensagemTipo, template: string): string {
  let out = fixEmojiEncoding(sanitizeTemplateText(template));
  if (!out) return out;

  out = out
    .replace(/\{\{link_maps\}\}/g, '{{link_maps_curto}}')
    .replace(/\{\{link_calendario\}\}/g, '{{link_calendario_curto}}');

  if (tipo === 'convite_agendamento' && out.includes('{{link}}') && !out.includes('{{link_curto}}')) {
    out = out.replace(/\{\{link\}\}/g, '{{link_curto}}');
  }

  if (TIPOS_SEM_MAPS.includes(tipo)) {
    out = stripMapsBlock(out);
  }
  if (TIPOS_SEM_CALENDARIO.includes(tipo) && tipo !== 'convite_agendamento') {
    out = stripCalendarBlock(out);
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
  return prepareMensagemForSave(tipo, trimmed);
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

/** Remove bloco Maps de template ou mensagem renderizada (confirmação WA sem Maps). */
function stripMapsBlock(text: string): string {
  let out = text;
  out = out.replace(
    /\n?[🗺\uFFFD]?[^\n]*Como chegar:[^\n]*\n?\{\{link_maps_curto\}\}\n?/gi,
    '\n',
  );
  out = out.replace(/\n?[🗺\uFFFD]?[^\n]*Como chegar:[^\n]*\n?\{\{link_maps\}\}\n?/gi, '\n');
  out = out.replace(
    /\n?[🗺\uFFFD]?[^\n]*Como chegar:\s*\n?https?:\/\/[^\n]+\n?/gi,
    '\n',
  );
  out = out.replace(/\s+Como chegar:\s*https?:\/\/\S+/gi, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Remove bloco "Adicionar à sua agenda" de template ou mensagem renderizada (lembrete 1 dia sem agenda). */
function stripCalendarBlock(text: string): string {
  let out = text;
  out = out.replace(
    /\n?[^\n]*Adicionar à sua agenda:[^\n]*\n?\{\{link_calendario_curto\}\}\n?/gi,
    '\n',
  );
  out = out.replace(
    /\n?[^\n]*Adicionar à sua agenda:[^\n]*\n?\{\{link_calendario\}\}\n?/gi,
    '\n',
  );
  out = out.replace(
    /\n?[^\n]*Adicionar à sua agenda:\s*\n?https?:\/\/[^\n]+\n?/gi,
    '\n',
  );
  out = out.replace(/\s+Adicionar à sua agenda:\s*https?:\/\/\S+/gi, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Remove cabeçalho de agenda sem URL na linha seguinte (placeholder vazio removido antes). */
function stripOrphanCalendarHeader(text: string): string {
  return text.replace(/Adicionar à sua agenda:\s*\n(?!\S)/g, '');
}

/** Remove cabeçalho de Maps sem URL na linha seguinte (placeholder vazio removido antes). */
function stripOrphanMapsHeader(text: string): string {
  return text.replace(/^[^\n]*Como chegar:\s*\n(?!\S)/gim, '');
}

/**
 * Regras por tipo (padrão do produto):
 * - lembrete_7_dias: sem "Como chegar" (endereço basta) — mantém "Adicionar à sua agenda".
 * - lembrete_1_dia: com "Como chegar" — sem "Adicionar à sua agenda" (cliente já adicionou).
 * - confirmacao_apos_agendar: sem "Como chegar" — Maps fica no evento da agenda.
 */
const TIPOS_SEM_MAPS: MensagemTipo[] = ['confirmacao_apos_agendar', 'lembrete_7_dias'];
const TIPOS_SEM_CALENDARIO: MensagemTipo[] = ['convite_agendamento', 'lembrete_1_dia'];

function safeShortUrl(targetUrl: string, kind: 'maps' | 'calendario' | 'generic'): string {
  const trimmed = targetUrl.trim();
  if (!trimmed) return '';
  try {
    return createShortRedirectUrl(trimmed);
  } catch {
    // Em produção sem AUTH_SECRET no cliente, mantém URL completa funcional.
    if (typeof window === 'undefined') return trimmed;
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
  const semMaps = !!tipo && TIPOS_SEM_MAPS.includes(tipo);
  const semCalendario = tipo === 'lembrete_1_dia';

  const tplBaseRaw = tipo ? normalizeMensagemTemplate(tipo, template) : template;
  let tplBase = semMaps ? stripMapsBlock(tplBaseRaw) : tplBaseRaw;
  if (semCalendario) tplBase = stripCalendarBlock(tplBase);

  const enrichedBase = enrichMensagemVarsWithShortLinks(vars);
  let enriched = semMaps
    ? { ...enrichedBase, link_maps: '', link_maps_curto: '' }
    : enrichedBase;
  if (semCalendario) {
    enriched = { ...enriched, link_calendario: '', link_calendario_curto: '' };
  }

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

  const varsForOmit: MensagemVars = {
    ...enriched,
    link_maps_curto: linkMapsCurto || enriched.link_maps_curto,
    link_calendario_curto: linkCalCurto || enriched.link_calendario_curto,
    link_maps: linkMapsCurto || enriched.link_maps,
    link_calendario: linkCalCurto || enriched.link_calendario,
  };

  let tpl = omitEmptyOptionalLines(tplBase, varsForOmit);
  let out = tpl;
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }

  out = stripOrphanCalendarHeader(out);
  out = stripOrphanMapsHeader(out);

  const linkMaps = linkMapsCurto || enriched.link_maps?.trim() || '';
  const linkCal = linkCalCurto || enriched.link_calendario?.trim() || '';
  const hasMapsPlaceholder =
    tplBase.includes('{{link_maps}}') || tplBase.includes('{{link_maps_curto}}');

  if (linkMaps && !semMaps && !hasMapsPlaceholder && !out.includes(linkMaps)) {
    out = `${out.trim()}\n\n${MAPS_APPEND_PREFIX}${linkMaps}`;
  }
  if (
    linkCal &&
    !semCalendario &&
    tipo !== 'convite_agendamento' &&
    !out.includes(linkCal)
  ) {
    out = `${out.trim()}\n\n${CALENDAR_APPEND_PREFIX}${linkCal}`;
  }

  if (tipo === 'confirmacao_apos_agendar') {
    out = stripMapsBlock(out);
    if (linkCal) {
      if (!/Adicionar à sua agenda:/i.test(out)) {
        out = `${out.trim()}\n\n${CALENDAR_APPEND_PREFIX}${linkCal}`;
      } else if (!out.includes(linkCal)) {
        out = `${out.trim()}\n${linkCal}`;
      }
    }
  }

  return fixEmojiEncoding(out.replace(/\n{3,}/g, '\n\n').trim());
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
    return prepareMensagemForSave(tipo, sanitized) !== sanitized;
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
