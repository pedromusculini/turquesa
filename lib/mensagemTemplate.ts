import type { MensagemTipo, MensagemVars } from '@/lib/mensagensWhatsapp';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { DEFAULT_MENSAGENS } from '@/lib/mensagensWhatsapp';
import { enderecoVarsFromProfile, googleMapsUrlFromProfile } from '@/lib/agendamento';
import { previewShortRedirectUrl } from '@/lib/shortLink';

const TOKEN_RE =
  /(\{\{(?:nome|data|hora|medico|local|clinica|link|link_calendario|link_maps|link_calendario_curto|link_maps_curto)\}\})/g;

export type TemplatePart =
  | { type: 'text'; value: string }
  | { type: 'token'; token: string };

export const PLACEHOLDER_LABELS: Record<string, string> = {
  '{{nome}}': 'Nome do cliente',
  '{{data}}': 'Data do atendimento',
  '{{hora}}': 'Horário',
  '{{medico}}': 'Nome do profissional',
  '{{local}}': 'Endereço / local',
  '{{clinica}}': 'Nome do salão',
  '{{link}}': 'Link de agendamento',
  '{{link_calendario}}': 'Link adicionar à agenda (completo)',
  '{{link_maps}}': 'Link Google Maps (completo)',
  '{{link_calendario_curto}}': 'Link agenda curto (recomendado)',
  '{{link_maps_curto}}': 'Link Maps curto (recomendado)',
};

/** Variáveis que não podem ser removidas por tipo de mensagem */
export const REQUIRED_BY_TIPO: Record<MensagemTipo, string[]> = {
  convite_agendamento: ['{{nome}}', '{{link}}'],
  lembrete_7_dias: ['{{nome}}', '{{data}}', '{{hora}}'],
  lembrete_1_dia: ['{{nome}}', '{{data}}', '{{hora}}'],
  confirmacao_apos_agendar: ['{{nome}}', '{{data}}', '{{hora}}'],
};

export function parseTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, 'g');
  while ((match = re.exec(template)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', value: template.slice(last, match.index) });
    }
    parts.push({ type: 'token', token: match[1] });
    last = match.index + match[1].length;
  }
  if (last < template.length) {
    parts.push({ type: 'text', value: template.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ type: 'text', value: '' });
  }
  return parts;
}

export function serializeTemplate(parts: TemplatePart[]): string {
  return parts.map((p) => (p.type === 'text' ? p.value : p.token)).join('');
}

function insertTokenBefore(template: string, token: string, before: string): string {
  const idx = template.indexOf(before);
  if (idx >= 0) return template.slice(0, idx) + token + template.slice(idx);
  return template + token;
}

/** Garante tokens obrigatórios; reidrata a partir do padrão se faltarem */
export function ensureRequiredPlaceholders(
  template: string,
  tipo: MensagemTipo,
): string {
  const required = REQUIRED_BY_TIPO[tipo];
  const fallback = DEFAULT_MENSAGENS[tipo];
  let out = template;

  for (const token of required) {
    if (out.includes(token)) continue;
    if (fallback.includes(token)) {
      out = insertTokenFromDefault(out, fallback, token);
    } else {
      out = `${out.trim()}\n${token}`;
    }
  }
  return out;
}

function insertTokenFromDefault(current: string, fallback: string, token: string): string {
  const parts = parseTemplate(fallback);
  const idx = parts.findIndex((p) => p.type === 'token' && p.token === token);
  if (idx < 0) return current + token;

  const before =
    idx > 0 && parts[idx - 1].type === 'text'
      ? (parts[idx - 1] as { type: 'text'; value: string }).value.trimEnd()
      : '';
  const after =
    idx < parts.length - 1 && parts[idx + 1].type === 'text'
      ? (parts[idx + 1] as { type: 'text'; value: string }).value.trimStart()
      : '';

  if (before && current.includes(before.slice(-20))) {
    return insertTokenBefore(current, token, before.slice(-20));
  }
  if (after && current.includes(after.slice(0, 20))) {
    const i = current.indexOf(after.slice(0, 20));
    return current.slice(0, i) + token + current.slice(i);
  }
  return current.trim() + '\n' + token;
}

export function validateTemplate(
  template: string,
  tipo: MensagemTipo,
): { ok: boolean; missing: string[] } {
  const required = REQUIRED_BY_TIPO[tipo];
  const missing = required.filter((t) => !template.includes(t));
  return { ok: missing.length === 0, missing };
}

/** Dados fictícios para pré-visualização na tela de Configurações */
const PREVIEW_ENDERECO = {
  street: 'Av. Brasil',
  address_number: '500',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
};

export const PREVIEW_SAMPLE_VARS: MensagemVars = {
  nome: 'Maria Silva',
  data: '15/06/2026',
  hora: '14:30',
  medico: 'Ana Souza',
  local: enderecoVarsFromProfile(PREVIEW_ENDERECO).local,
  clinica: 'Estúdio Turquesa',
  link: `${CANONICAL_APP_URL}/agendar/sua-clinica`,
  link_calendario: `${CANONICAL_APP_URL}/calendario/adicionar/exemplo`,
  link_maps: googleMapsUrlFromProfile(PREVIEW_ENDERECO),
  link_calendario_curto: previewShortRedirectUrl('calendario'),
  link_maps_curto: previewShortRedirectUrl('maps'),
};

/** Monta variáveis de prévia a partir do perfil (real ou DEV_BYPASS). */
export function previewVarsFromProfile(
  profile?: Record<string, unknown> | null,
): MensagemVars {
  const endereco = enderecoVarsFromProfile(profile ?? null);
  return {
    ...PREVIEW_SAMPLE_VARS,
    local: endereco.local || PREVIEW_SAMPLE_VARS.local,
    link_maps: endereco.link_maps || PREVIEW_SAMPLE_VARS.link_maps,
    clinica:
      String(profile?.clinic_name ?? profile?.full_name ?? '').trim() ||
      PREVIEW_SAMPLE_VARS.clinica,
  };
}

export const MENSAGEM_TIPO_INFO: Record<
  MensagemTipo,
  { titulo: string; quando: string }
> = {
  convite_agendamento: {
    titulo: 'Convite para agendar',
    quando:
      'Quando você envia o link de agendamento ao cliente (WhatsApp manual ou copiar link).',
  },
  lembrete_7_dias: {
    titulo: 'Lembrete — antecedência',
    quando:
      'Lembrete no Dashboard nos dias de antecedência definidos em Configurações (botão WhatsApp).',
  },
  lembrete_1_dia: {
    titulo: 'Lembrete 1 dia antes',
    quando: 'Lembrete no Dashboard, 1 dia antes da sessão (botão WhatsApp).',
  },
  confirmacao_apos_agendar: {
    titulo: 'Confirmação após reserva',
    quando: 'Após o cliente reservar horário pelo link público de agendamento.',
  },
};
