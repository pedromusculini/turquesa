import { supabaseAdmin } from '@/lib/supabaseClient';
import { VERIFICATION_CODE_DIGITS } from '@/lib/constants';

/** Dias sem login para exigir novo código por e-mail */
export const EMAIL_REVERIFY_INACTIVE_DAYS = 30;

export const GOOGLE_ACCESS_CODE_PURPOSE = 'google_access';

export type GoogleAccountRow = {
  google_sub: string;
  email: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  trial_started_at: string | null;
  trial_consumed: boolean;
};

export type GoogleAccessState = {
  googleSub: string;
  email: string;
  accessVerified: boolean;
  needsEmailVerification: boolean;
  reverifyDueToInactivity: boolean;
  trialEligible: boolean;
  trialConsumed: boolean;
  trialStartedAt: string | null;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function needsEmailVerification(row: GoogleAccountRow | null): boolean {
  if (!row) return true;
  if (!row.email_verified_at) return true;
  const inactive = daysSince(row.last_login_at);
  if (inactive === null) return true;
  return inactive >= EMAIL_REVERIFY_INACTIVE_DAYS;
}

export function buildAccessState(
  row: GoogleAccountRow | null,
  email: string,
  googleSub: string,
): GoogleAccessState {
  const needs = needsEmailVerification(row);
  const inactive =
    !!row?.email_verified_at &&
    (daysSince(row.last_login_at) ?? EMAIL_REVERIFY_INACTIVE_DAYS) >=
      EMAIL_REVERIFY_INACTIVE_DAYS;

  return {
    googleSub,
    email,
    accessVerified: !needs,
    needsEmailVerification: needs,
    reverifyDueToInactivity: inactive,
    trialEligible: row ? !row.trial_consumed : true,
    trialConsumed: row?.trial_consumed ?? false,
    trialStartedAt: row?.trial_started_at ?? null,
  };
}

export async function getGoogleAccountBySub(
  googleSub: string,
): Promise<GoogleAccountRow | null> {
  const { data, error } = await supabaseAdmin
    .from('google_account_access')
    .select('*')
    .eq('google_sub', googleSub)
    .maybeSingle();

  if (error) {
    console.error('[googleAccountAccess] getBySub:', error);
    return null;
  }
  return data as GoogleAccountRow | null;
}

export async function ensureGoogleAccount(
  googleSub: string,
  email: string,
): Promise<GoogleAccountRow | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await getGoogleAccountBySub(googleSub);

  if (existing) {
    if (existing.email !== normalizedEmail) {
      await supabaseAdmin
        .from('google_account_access')
        .update({
          email: normalizedEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('google_sub', googleSub);
    }
    return { ...existing, email: normalizedEmail };
  }

  const { data, error } = await supabaseAdmin
    .from('google_account_access')
    .insert({
      google_sub: googleSub,
      email: normalizedEmail,
      trial_consumed: false,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[googleAccountAccess] ensure insert:', error);
    return null;
  }
  return data as GoogleAccountRow;
}

/** Atualiza último acesso quando já verificado e dentro da janela de 30 dias */
export async function touchLastLoginIfVerified(googleSub: string): Promise<void> {
  const row = await getGoogleAccountBySub(googleSub);
  if (!row || needsEmailVerification(row)) return;

  await supabaseAdmin
    .from('google_account_access')
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('google_sub', googleSub);
}

function isGoogleAccessTableMissing(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('google_account_access') ||
    msg.includes('schema cache')
  );
}

export const GOOGLE_ACCESS_TABLE_SETUP_HINT =
  'Execute no Supabase o arquivo sql/google_account_access_schema.sql (ou rode: npm run db:google-access).';

/** Marca e-mail confirmado; cria o registro se ainda não existir (upsert). */
export async function markEmailVerified(
  googleSub: string,
  email: string,
): Promise<void> {
  const now = new Date().toISOString();
  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('google_account_access')
    .upsert(
      {
        google_sub: googleSub,
        email: normalizedEmail,
        email_verified_at: now,
        last_login_at: now,
        trial_consumed: false,
        updated_at: now,
      },
      { onConflict: 'google_sub' },
    )
    .select('google_sub')
    .single();

  if (error) {
    if (isGoogleAccessTableMissing(error)) {
      throw new Error(`MISSING_TABLE:${GOOGLE_ACCESS_TABLE_SETUP_HINT}`);
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(`MISSING_ROW:${GOOGLE_ACCESS_TABLE_SETUP_HINT}`);
  }
}

export async function markTrialConsumed(googleSub: string): Promise<void> {
  const row = await getGoogleAccountBySub(googleSub);
  const now = new Date().toISOString();

  await supabaseAdmin
    .from('google_account_access')
    .update({
      trial_consumed: true,
      trial_started_at: row?.trial_started_at ?? now,
      updated_at: now,
    })
    .eq('google_sub', googleSub);
}

export async function getAccessStateForUser(
  googleSub: string,
  email: string,
): Promise<GoogleAccessState> {
  const row = await ensureGoogleAccount(googleSub, email);
  const state = buildAccessState(row, email.toLowerCase().trim(), googleSub);

  if (state.accessVerified) {
    await touchLastLoginIfVerified(googleSub);
  }

  return state;
}

/** Código OTP numérico (VERIFICATION_CODE_DIGITS dígitos). */
export function generateVerificationCode(): string {
  const min = 10 ** (VERIFICATION_CODE_DIGITS - 1);
  const max = 10 ** VERIFICATION_CODE_DIGITS - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

/** @deprecated Use generateVerificationCode */
export function generateFourDigitCode(): string {
  return generateVerificationCode();
}

export async function recordPrivacyConsent(
  googleSub: string,
  privacyVersion: string,
  termsVersion: string,
): Promise<void> {
  await supabaseAdmin
    .from('google_account_access')
    .update({
      privacy_policy_version: privacyVersion,
      terms_version: termsVersion,
      privacy_consent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('google_sub', googleSub);
}
