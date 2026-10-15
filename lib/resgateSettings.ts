import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  clampResgateDiasLimite,
  DEFAULT_RESGATE_SETTINGS,
  type ResgateWhatsappSettings,
} from '@/lib/resgateSettingsFormat';

export * from '@/lib/resgateSettingsFormat';

function isResgateColumnsMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42703' ||
    (error.message?.includes('resgate_cliente') ?? false) ||
    (error.message?.includes('resgate_dias_limite') ?? false)
  );
}

export async function getResgateSettings(ownerEmail: string): Promise<ResgateWhatsappSettings> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('mensagens_whatsapp_config')
    .select('resgate_cliente_ativo, resgate_dias_limite')
    .eq('owner_email', owner)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || isResgateColumnsMissing(error)) {
      return { ...DEFAULT_RESGATE_SETTINGS };
    }
    throw error;
  }
  if (!data) return { ...DEFAULT_RESGATE_SETTINGS };

  return {
    resgate_cliente_ativo: data.resgate_cliente_ativo === true,
    resgate_dias_limite: clampResgateDiasLimite(Number(data.resgate_dias_limite ?? 30)),
  };
}

export async function saveResgateSettings(
  ownerEmail: string,
  settings: Partial<ResgateWhatsappSettings>,
): Promise<ResgateWhatsappSettings> {
  const owner = ownerEmail.toLowerCase().trim();
  const current = await getResgateSettings(owner);
  const merged: ResgateWhatsappSettings = {
    resgate_cliente_ativo: settings.resgate_cliente_ativo ?? current.resgate_cliente_ativo,
    resgate_dias_limite: clampResgateDiasLimite(
      settings.resgate_dias_limite ?? current.resgate_dias_limite,
    ),
  };

  const { error } = await supabaseAdmin.from('mensagens_whatsapp_config').upsert(
    {
      owner_email: owner,
      resgate_cliente_ativo: merged.resgate_cliente_ativo,
      resgate_dias_limite: merged.resgate_dias_limite,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_email' },
  );

  if (error) {
    if (isResgateColumnsMissing(error)) {
      console.warn(
        '[resgateSettings] Colunas ausentes — execute npm run db:resgate-cliente',
      );
      return merged;
    }
    throw error;
  }
  return merged;
}
