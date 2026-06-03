import { supabaseAdmin } from '@/lib/supabaseClient';
import { CANONICAL_APP_URL } from '@/lib/constants';

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
] as const;

export const DEFAULT_MENSAGENS: MensagensWhatsappConfig = {
  convite_agendamento: `Olá, {{nome}}!

Você pode agendar sua consulta pelo link abaixo:
{{link}}

Qualquer dúvida, responda por aqui.`,
  lembrete_7_dias: `Olá, {{nome}}! Lembrete: sua consulta é em 7 dias ({{data}} às {{hora}}) com {{medico}}.
Local: {{local}}

Adicionar à sua agenda: {{link_calendario}}`,
  lembrete_1_dia: `Olá, {{nome}}! Amanhã você tem consulta às {{hora}} ({{data}}) com {{medico}}.
Local: {{local}}

Adicionar à sua agenda: {{link_calendario}}`,
  confirmacao_apos_agendar: `Olá, {{nome}}! Sua consulta foi reservada para {{data}} às {{hora}} com {{medico}}.
Local: {{local}}

Adicionar à sua agenda: {{link_calendario}}`,
};

export function renderMensagem(template: string, vars: MensagemVars): string {
  const map: Record<string, string> = {
    nome: vars.nome ?? '',
    data: vars.data ?? '',
    hora: vars.hora ?? '',
    medico: vars.medico ?? '',
    local: vars.local ?? '',
    clinica: vars.clinica ?? '',
    link: vars.link ?? '',
    link_calendario: vars.link_calendario ?? '',
  };
  let out = template;
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value);
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
  if (!data) return { ...DEFAULT_MENSAGENS };

  return {
    convite_agendamento: data.convite_agendamento || DEFAULT_MENSAGENS.convite_agendamento,
    lembrete_7_dias: data.lembrete_7_dias || DEFAULT_MENSAGENS.lembrete_7_dias,
    lembrete_1_dia: data.lembrete_1_dia || DEFAULT_MENSAGENS.lembrete_1_dia,
    confirmacao_apos_agendar:
      data.confirmacao_apos_agendar || DEFAULT_MENSAGENS.confirmacao_apos_agendar,
  };
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
