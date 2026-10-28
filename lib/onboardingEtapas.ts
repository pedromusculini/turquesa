/**
 * Etapas do primeiro uso (cadastro → Google → agenda → link no WhatsApp).
 *
 * Nunca lança: falha ao registrar não pode atrapalhar o onboarding.
 * Sem dados pessoais da cliente (LGPD): só e-mail do salão, etapa e hora.
 */
import { supabaseAdmin } from '@/lib/supabaseClient';

const TABLE = 'onboarding_etapas';

export const ONBOARDING_ETAPAS = [
  'cadastro_salvo',
  'preparo_ok',
  'google_redirecionado',
  'agenda_direta',
  'gate_google_visto',
  'agenda_primeiro_uso',
  'cta_whatsapp',
  'cta_testar',
  'cta_fechar',
] as const;

export type OnboardingEtapa = (typeof ONBOARDING_ETAPAS)[number];

export function isOnboardingEtapa(value: unknown): value is OnboardingEtapa {
  return (
    typeof value === 'string' &&
    (ONBOARDING_ETAPAS as readonly string[]).includes(value)
  );
}

/** Grava a etapa só na primeira vez (ignora repetição). */
export async function registrarEtapaOnboarding(
  ownerEmail: string,
  etapa: OnboardingEtapa,
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  if (!owner) return;
  try {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert(
        { owner_email: owner, etapa },
        { onConflict: 'owner_email,etapa', ignoreDuplicates: true },
      );
    if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
      console.warn('[onboardingEtapas] gravação falhou', error.message);
    }
  } catch (err) {
    console.warn('[onboardingEtapas] gravação falhou', err);
  }
}
