import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  clampLembreteAntecedenciaDias,
  DEFAULT_LEMBRETES_SETTINGS,
  type LembretesWhatsappSettings,
} from '@/lib/lembretesSettingsFormat';

export * from '@/lib/lembretesSettingsFormat';

function isLembretesColumnsMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42703' ||
    (error.message?.includes('lembrete_antecedencia') ?? false)
  );
}

export async function getLembretesSettings(
  ownerEmail: string,
): Promise<LembretesWhatsappSettings> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('mensagens_whatsapp_config')
    .select(
      'lembrete_antecedencia_ativo, lembrete_antecedencia_dias, lembrete_1_dia_ativo',
    )
    .eq('owner_email', owner)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || isLembretesColumnsMissing(error)) {
      return { ...DEFAULT_LEMBRETES_SETTINGS };
    }
    throw error;
  }
  if (!data) return { ...DEFAULT_LEMBRETES_SETTINGS };

  return {
    lembrete_antecedencia_ativo: data.lembrete_antecedencia_ativo !== false,
    lembrete_antecedencia_dias: clampLembreteAntecedenciaDias(
      Number(data.lembrete_antecedencia_dias ?? 7),
    ),
    lembrete_1_dia_ativo: data.lembrete_1_dia_ativo !== false,
  };
}

export async function saveLembretesSettings(
  ownerEmail: string,
  settings: Partial<LembretesWhatsappSettings>,
): Promise<LembretesWhatsappSettings> {
  const owner = ownerEmail.toLowerCase().trim();
  const current = await getLembretesSettings(owner);
  const merged: LembretesWhatsappSettings = {
    lembrete_antecedencia_ativo:
      settings.lembrete_antecedencia_ativo ?? current.lembrete_antecedencia_ativo,
    lembrete_antecedencia_dias: clampLembreteAntecedenciaDias(
      settings.lembrete_antecedencia_dias ?? current.lembrete_antecedencia_dias,
    ),
    lembrete_1_dia_ativo: settings.lembrete_1_dia_ativo ?? current.lembrete_1_dia_ativo,
  };

  const { error } = await supabaseAdmin.from('mensagens_whatsapp_config').upsert(
    {
      owner_email: owner,
      lembrete_antecedencia_ativo: merged.lembrete_antecedencia_ativo,
      lembrete_antecedencia_dias: merged.lembrete_antecedencia_dias,
      lembrete_1_dia_ativo: merged.lembrete_1_dia_ativo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_email' },
  );

  if (error) {
    if (isLembretesColumnsMissing(error)) {
      console.warn(
        '[lembretesSettings] Colunas ausentes em mensagens_whatsapp_config — execute npm run db:lembretes-config',
      );
      return merged;
    }
    throw error;
  }
  return merged;
}
