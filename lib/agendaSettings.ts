import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  clampDuracaoMinutos,
  isDuracaoMinutosValid,
} from '@/lib/disponibilidadeSlots';

export type AgendaSettings = {
  /** Null = sem duração padrão; exige fim manual ao agendar. */
  duracao_padrao_minutos: number | null;
};

export const DEFAULT_AGENDA_SETTINGS: AgendaSettings = {
  duracao_padrao_minutos: null,
};

function isAgendaColumnMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42703' ||
    (error.message?.includes('agenda_duracao_padrao_minutos') ?? false)
  );
}

function parseDuracaoPadrao(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!isDuracaoMinutosValid(n)) return null;
  return clampDuracaoMinutos(n);
}

export async function getAgendaSettings(ownerEmail: string): Promise<AgendaSettings> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('agenda_duracao_padrao_minutos')
    .eq('email', owner)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || isAgendaColumnMissing(error)) {
      return { ...DEFAULT_AGENDA_SETTINGS };
    }
    throw error;
  }

  return {
    duracao_padrao_minutos: parseDuracaoPadrao(data?.agenda_duracao_padrao_minutos),
  };
}

export async function saveAgendaSettings(
  ownerEmail: string,
  settings: Partial<AgendaSettings>,
): Promise<AgendaSettings> {
  const owner = ownerEmail.toLowerCase().trim();
  const current = await getAgendaSettings(owner);

  let duracao: number | null = current.duracao_padrao_minutos;
  if ('duracao_padrao_minutos' in settings) {
    const v = settings.duracao_padrao_minutos;
    if (v === null || v === undefined) {
      duracao = null;
    } else if (isDuracaoMinutosValid(v)) {
      duracao = clampDuracaoMinutos(v);
    } else {
      throw new Error('Duração padrão inválida (use entre 20 e 480 minutos).');
    }
  }

  const merged: AgendaSettings = { duracao_padrao_minutos: duracao };

  const { error } = await supabaseAdmin
    .from('onboarding_profiles')
    .update({
      agenda_duracao_padrao_minutos: merged.duracao_padrao_minutos,
      updated_at: new Date().toISOString(),
    })
    .eq('email', owner);

  if (error) {
    if (isAgendaColumnMissing(error)) {
      console.warn(
        '[agendaSettings] Coluna agenda_duracao_padrao_minutos ausente — execute npm run db:agenda-config',
      );
      return merged;
    }
    throw error;
  }

  return merged;
}
