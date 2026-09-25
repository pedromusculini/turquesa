import type { MensagemTipo, MensagemVars } from '@/lib/mensagensWhatsapp';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { DEFAULT_MENSAGENS } from '@/lib/mensagensWhatsapp';
import { enderecoVarsFromProfile, googleMapsUrlFromProfile } from '@/lib/agendamento';
import { previewShortRedirectUrl } from '@/lib/shortLink';

const TOKEN_RE =
  /(\{\{(?:nome|data|hora|medico|local|clinica|link|link_curto|link_calendario|link_maps|link_calendario_curto|link_maps_curto|dias_sem_retorno|ultima_sessao|pacote_nome|sessao_numero|sessoes_total|sessoes_restantes|sessoes_datas|link_cadastro|link_catalogo|link_site)\}\})/g;

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
  '{{link_curto}}': 'Link de agendamento curto (recomendado)',
  '{{link_calendario}}': 'Link adicionar à agenda (completo)',
  '{{link_maps}}': 'Link Google Maps (completo)',
  '{{link_calendario_curto}}': 'Link agenda curto (recomendado)',
  '{{link_maps_curto}}': 'Link Maps curto (recomendado)',
  '{{dias_sem_retorno}}': 'Dias desde a última sessão',
  '{{ultima_sessao}}': 'Data da última sessão realizada',
  '{{pacote_nome}}': 'Nome do pacote',
  '{{sessao_numero}}': 'Número da sessão feita',
  '{{sessoes_total}}': 'Total de sessões do pacote',
  '{{sessoes_restantes}}': 'Sessões restantes',
  '{{sessoes_datas}}': 'Lista de sessões feitas (com datas)',
  '{{link_cadastro}}': 'Link de autocadastro',
  '{{link_catalogo}}': 'Link do catálogo (serviços e preços)',
  '{{link_site}}': 'Link do site do salão',
};

/** Variáveis que não podem ser removidas por tipo de mensagem */
export const REQUIRED_BY_TIPO: Record<MensagemTipo, string[]> = {
  convite_agendamento: ['{{nome}}', '{{link}}'],
  lembrete_7_dias: ['{{nome}}', '{{data}}', '{{hora}}'],
  lembrete_1_dia: ['{{nome}}', '{{data}}', '{{hora}}'],
  confirmacao_apos_agendar: ['{{nome}}', '{{data}}', '{{hora}}', '{{link_calendario_curto}}'],
  resgate_cliente: ['{{nome}}', '{{link}}', '{{dias_sem_retorno}}', '{{ultima_sessao}}'],
  pacote_sessao: ['{{sessao_numero}}', '{{sessoes_total}}', '{{sessoes_restantes}}'],
  boas_vindas: [],
};

/**
 * Campos que o salão pode tirar e colocar de volta (botões "+ inserir").
 * Nos demais tipos os blocos continuam travados como antes.
 */
export const INSERTABLE_BY_TIPO: Partial<Record<MensagemTipo, string[]>> = {
  pacote_sessao: [
    '{{nome}}',
    '{{pacote_nome}}',
    '{{data}}',
    '{{sessoes_datas}}',
    '{{link_curto}}',
    '{{clinica}}',
  ],
  boas_vindas: [
    '{{clinica}}',
    '{{link_curto}}',
    '{{link_cadastro}}',
    '{{link_catalogo}}',
    '{{link_site}}',
    '{{local}}',
    '{{link_maps_curto}}',
  ],
};

/** Aceita {{link}} ou {{link_curto}} no convite. */
export function validateTemplate(
  template: string,
  tipo: MensagemTipo,
): { ok: boolean; missing: string[] } {
  const required = REQUIRED_BY_TIPO[tipo];
  const missing = required.filter((t) => {
    if (t === '{{link}}' && tipo === 'convite_agendamento') {
      return !template.includes('{{link}}') && !template.includes('{{link_curto}}');
    }
    if (t === '{{link}}' && tipo === 'resgate_cliente') {
      return !template.includes('{{link}}') && !template.includes('{{link_curto}}');
    }
    if (t === '{{link_calendario_curto}}' && tipo === 'confirmacao_apos_agendar') {
      return (
        !template.includes('{{link_calendario_curto}}') &&
        !template.includes('{{link_calendario}}')
      );
    }
    return !template.includes(t);
  });
  return { ok: missing.length === 0, missing };
}

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
    if (
      token === '{{link}}' &&
      tipo === 'convite_agendamento' &&
      out.includes('{{link_curto}}')
    ) {
      continue;
    }
    if (
      token === '{{link_calendario_curto}}' &&
      tipo === 'confirmacao_apos_agendar' &&
      out.includes('{{link_calendario}}')
    ) {
      continue;
    }
    const fallbackToken =
      token === '{{link}}' &&
      tipo === 'convite_agendamento' &&
      fallback.includes('{{link_curto}}')
        ? '{{link_curto}}'
        : token === '{{link_calendario_curto}}' &&
            tipo === 'confirmacao_apos_agendar' &&
            fallback.includes('{{link_calendario_curto}}')
          ? '{{link_calendario_curto}}'
          : token;
    if (fallback.includes(fallbackToken)) {
      out = insertTokenFromDefault(out, fallback, fallbackToken);
    } else if (fallback.includes(token)) {
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
  link_curto: previewShortRedirectUrl('generic'),
  link_calendario: `${CANONICAL_APP_URL}/calendario/adicionar/exemplo`,
  link_maps: googleMapsUrlFromProfile(PREVIEW_ENDERECO),
  link_calendario_curto: previewShortRedirectUrl('calendario'),
  link_maps_curto: previewShortRedirectUrl('maps'),
  dias_sem_retorno: '45',
  ultima_sessao: '15/04/2026',
  pacote_nome: '10 sessões de depilação',
  sessao_numero: '3',
  sessoes_total: '10',
  sessoes_restantes: '7',
  sessoes_datas: '✅ 1ª — 01/06/2026\n✅ 2ª — 08/06/2026\n✅ 3ª — 15/06/2026',
  link_cadastro: `${CANONICAL_APP_URL}/f/exemplo`,
  link_catalogo: `${CANONICAL_APP_URL}/c/exemplo`,
  link_site: `${CANONICAL_APP_URL}/s/sua-clinica`,
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
  resgate_cliente: {
    titulo: 'Resgate de cliente',
    quando:
      'Mensagem para clientes sem retorno — fila no Dashboard e botão WhatsApp no Relatório de clientes.',
  },
  pacote_sessao: {
    titulo: 'Controle de sessões do pacote',
    quando:
      'Abre no WhatsApp ao finalizar um atendimento que usou sessão de pacote (ex.: sessão 3 de 10).',
  },
  boas_vindas: {
    titulo: 'Boas-vindas para cliente nova',
    quando:
      'Para copiar e colar quando uma cliente nova chama no WhatsApp — com os links que você escolher.',
  },
};
