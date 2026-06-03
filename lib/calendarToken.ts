import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { buildCalendarAddPageUrl } from '@/lib/calendarInvite';

const TOKEN_TTL_DAYS = 90;

export function generateToken(): string {
  return randomBytes(24).toString('hex');
}

export async function getOrCreateConsultaCalendarToken(params: {
  consultaId: string;
  ownerEmail: string;
}): Promise<string> {
  const owner = params.ownerEmail.toLowerCase().trim();
  const { data: existing } = await supabaseAdmin
    .from('consulta_calendario_tokens')
    .select('token, expires_at')
    .eq('consulta_id', params.consultaId)
    .eq('owner_email', owner)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing?.token) return existing.token;

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  await supabaseAdmin
    .from('consulta_calendario_tokens')
    .delete()
    .eq('consulta_id', params.consultaId);

  await supabaseAdmin.from('consulta_calendario_tokens').insert({
    token,
    consulta_id: params.consultaId,
    owner_email: owner,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function getConsultaCalendarLink(params: {
  consultaId: string;
  ownerEmail: string;
}): Promise<string> {
  const token = await getOrCreateConsultaCalendarToken(params);
  return buildCalendarAddPageUrl(token);
}

export async function resolveCalendarToken(token: string): Promise<{
  consulta_id: string;
  owner_email: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('consulta_calendario_tokens')
    .select('consulta_id, owner_email, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return { consulta_id: data.consulta_id, owner_email: data.owner_email };
}
