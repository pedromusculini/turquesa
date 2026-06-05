import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { encryptSecret, decryptSecret } from '@/lib/tokenEncryption';
import { googleScopeParamForIncremental } from '@/lib/googleIncrementalOAuth';

const INVITE_TTL_DAYS = 7;

export type ProfissionalCalendarRow = {
  id: string;
  clinica_medicos_id: string;
  google_sub: string | null;
  calendar_id: string;
  refresh_token_encrypted: string | null;
  connected_at: string | null;
  invite_token: string;
  invite_token_expires_at: string;
  invite_used_at: string | null;
};

export type ProfissionalAgendaStatus = 'connected' | 'pending' | null;

export function buildAgendaInvitePath(inviteToken: string): string {
  return `/convite/agenda/${inviteToken}`;
}

export function buildAgendaInviteUrl(inviteToken: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${buildAgendaInvitePath(inviteToken)}`;
}

function inviteExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d.toISOString();
}

export function isInviteValid(row: Pick<
  ProfissionalCalendarRow,
  'invite_token_expires_at' | 'connected_at' | 'invite_used_at'
>): boolean {
  if (row.connected_at) return false;
  if (row.invite_used_at) return false;
  return new Date(row.invite_token_expires_at).getTime() > Date.now();
}

export async function ensureProfissionalCalendarRow(
  clinicaMedicosId: string,
): Promise<ProfissionalCalendarRow> {
  const { data: existing } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('*')
    .eq('clinica_medicos_id', clinicaMedicosId)
    .maybeSingle();

  if (existing) return existing as ProfissionalCalendarRow;

  const { data, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .insert({
      clinica_medicos_id: clinicaMedicosId,
      invite_token: randomUUID(),
      invite_token_expires_at: inviteExpiresAt(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ProfissionalCalendarRow;
}

export async function regenerateProfissionalInvite(
  clinicaMedicosId: string,
  clinicaEmail: string,
): Promise<ProfissionalCalendarRow> {
  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id')
    .eq('id', clinicaMedicosId)
    .eq('clinica_email', clinicaEmail)
    .maybeSingle();

  if (medErr) throw medErr;
  if (!medico) throw new Error('Profissional não encontrada');

  await ensureProfissionalCalendarRow(clinicaMedicosId);

  const { data, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .update({
      invite_token: randomUUID(),
      invite_token_expires_at: inviteExpiresAt(),
      invite_used_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('clinica_medicos_id', clinicaMedicosId)
    .select('*')
    .single();

  if (error) throw error;
  return data as ProfissionalCalendarRow;
}

export async function loadCalendarRowsForMedicos(
  medicoIds: string[],
): Promise<Map<string, ProfissionalCalendarRow>> {
  if (!medicoIds.length) return new Map();

  const { data, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('*')
    .in('clinica_medicos_id', medicoIds);

  if (error) throw error;

  const map = new Map<string, ProfissionalCalendarRow>();
  for (const row of (data ?? []) as ProfissionalCalendarRow[]) {
    map.set(row.clinica_medicos_id, row);
  }
  return map;
}

export function agendaStatusFromRow(
  row: ProfissionalCalendarRow | undefined,
): ProfissionalAgendaStatus {
  if (!row) return null;
  if (row.connected_at && row.refresh_token_encrypted) return 'connected';
  if (isInviteValid(row)) return 'pending';
  return null;
}

export async function getInvitePublicInfo(inviteToken: string) {
  const { data: row, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('*')
    .eq('invite_token', inviteToken)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const cal = row as ProfissionalCalendarRow;

  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome, clinica_email')
    .eq('id', cal.clinica_medicos_id)
    .maybeSingle();

  if (medErr) throw medErr;
  if (!medico) return null;

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('clinic_name, full_name')
    .eq('email', medico.clinica_email)
    .maybeSingle();

  const nomeSalao =
    (profile?.clinic_name as string | undefined)?.trim() ||
    (profile?.full_name as string | undefined)?.trim() ||
    'Salão';

  return {
    profissionalId: medico.id,
    nomeProfissional: medico.nome,
    nomeSalao,
    alreadyConnected: !!cal.connected_at,
    inviteExpired: !isInviteValid(cal) && !cal.connected_at,
    inviteValid: isInviteValid(cal),
  };
}

export async function verifyProfissionalBelongsToInvite(
  inviteToken: string,
  profissionalId: string,
): Promise<ProfissionalCalendarRow | null> {
  const { data, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('*')
    .eq('invite_token', inviteToken)
    .eq('clinica_medicos_id', profissionalId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ProfissionalCalendarRow;
  if (!isInviteValid(row)) return null;
  return row;
}

export async function saveProfissionalCalendarConnection(params: {
  profissionalId: string;
  inviteToken: string;
  googleSub: string;
  refreshToken: string;
  calendarId?: string;
}) {
  const row = await verifyProfissionalBelongsToInvite(params.inviteToken, params.profissionalId);
  if (!row) throw new Error('Convite inválido ou expirado');

  const encrypted = encryptSecret(params.refreshToken);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .update({
      google_sub: params.googleSub,
      refresh_token_encrypted: encrypted,
      calendar_id: params.calendarId?.trim() || 'primary',
      connected_at: now,
      invite_used_at: now,
      updated_at: now,
    })
    .eq('id', row.id);

  if (error) throw error;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth não configurado');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || 'Falha ao renovar token Google');
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token as string | undefined;
  if (!accessToken) throw new Error('Token de acesso não recebido');

  return {
    accessToken,
    expiresIn: Number(tokenData.expires_in) || 3600,
  };
}

export async function getProfissionalAccessToken(
  profissionalId: string,
  clinicaEmail: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id')
    .eq('id', profissionalId)
    .eq('clinica_email', clinicaEmail)
    .maybeSingle();

  if (medErr) throw medErr;
  if (!medico) return null;

  const { data: row, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('*')
    .eq('clinica_medicos_id', profissionalId)
    .maybeSingle();

  if (error) throw error;
  const encrypted = row?.refresh_token_encrypted;
  if (!encrypted || !row?.connected_at) return null;

  const cal = row as ProfissionalCalendarRow;
  const refreshToken = decryptSecret(encrypted);
  const { accessToken } = await refreshGoogleAccessToken(refreshToken);

  return {
    accessToken,
    calendarId: cal.calendar_id || 'primary',
  };
}

export async function listConnectedProfissionalIds(clinicaEmail: string): Promise<string[]> {
  const { data: medicos, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id')
    .eq('clinica_email', clinicaEmail);

  if (medErr) throw medErr;
  const ids = (medicos ?? []).map((m) => m.id as string);
  if (!ids.length) return [];

  const { data: rows, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('clinica_medicos_id, connected_at, refresh_token_encrypted')
    .in('clinica_medicos_id', ids);

  if (error) throw error;

  return (rows ?? [])
    .filter((r) => r.connected_at && r.refresh_token_encrypted)
    .map((r) => r.clinica_medicos_id as string);
}

export function googleCalendarScopeParam(): string {
  return googleScopeParamForIncremental('calendar');
}
