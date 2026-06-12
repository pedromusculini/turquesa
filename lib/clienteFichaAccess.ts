import { supabaseAdmin } from '@/lib/supabaseClient';

export type ClienteFichaAccessResult =
  | { allowed: true; role: 'titular' | 'equipe'; nomeProfissional?: string }
  | { allowed: false; reason: string };

const INVALID_GOOGLE_SUB = new Set(['', 'unknown']);

export async function resolveOwnerEmailFromFormularioToken(
  token: string,
): Promise<
  { ok: true; ownerEmail: string } | { ok: false; status: number; error: string }
> {
  const { data: link, error } = await supabaseAdmin
    .from('formulario_links')
    .select('owner_email, ativo, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !link) {
    return { ok: false, status: 404, error: 'Link inválido ou expirado' };
  }

  if (!link.ativo) {
    return { ok: false, status: 410, error: 'Este link não está mais ativo' };
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { ok: false, status: 410, error: 'Link expirado' };
  }

  const ownerEmail = String(link.owner_email ?? '').trim().toLowerCase();
  if (!ownerEmail) {
    return { ok: false, status: 400, error: 'Link sem salão associado' };
  }

  return { ok: true, ownerEmail };
}

async function repairProfissionalGoogleSub(params: {
  calendarRowId: string;
  storedSub: string | null;
  sessionGoogleSub: string;
}): Promise<void> {
  const stored = (params.storedSub ?? '').trim();
  if (stored && stored === params.sessionGoogleSub) return;

  const { error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .update({
      google_sub: params.sessionGoogleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.calendarRowId);

  if (error) {
    console.error('[clienteFichaAccess] repair google_sub:', error);
  }
}

async function accessByGoogleSub(
  googleSub: string,
  ownerEmail: string,
): Promise<ClienteFichaAccessResult | null> {
  const { data: calRows, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('id, clinica_medicos_id, google_sub, connected_at')
    .eq('google_sub', googleSub)
    .not('connected_at', 'is', null);

  if (error) {
    console.error('[clienteFichaAccess] calendar lookup:', error);
    return { allowed: false, reason: 'Erro ao verificar permissões' };
  }

  if (!calRows?.length) return null;

  const medicoIds = calRows
    .map((row) => row.clinica_medicos_id)
    .filter((id): id is string | number => id != null);

  if (!medicoIds.length) return null;

  const { data: medicos, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome, clinica_email')
    .in('id', medicoIds)
    .eq('clinica_email', ownerEmail);

  if (medErr) {
    console.error('[clienteFichaAccess] medico lookup:', medErr);
    return { allowed: false, reason: 'Erro ao verificar permissões' };
  }

  const medico = medicos?.[0];
  if (!medico) return null;

  const calRow = calRows.find((row) => row.clinica_medicos_id === medico.id);
  if (calRow?.id) {
    await repairProfissionalGoogleSub({
      calendarRowId: calRow.id as string,
      storedSub: (calRow.google_sub as string | null) ?? null,
      sessionGoogleSub: googleSub,
    });
  }

  return {
    allowed: true,
    role: 'equipe',
    nomeProfissional: String(medico.nome ?? '').trim() || 'Profissional',
  };
}

/** Equipe cadastrada pelo e-mail do catálogo + agenda conectada (fallback se google_sub falhou no convite). */
async function accessByMedicoEmail(
  sessionEmail: string,
  ownerEmail: string,
  sessionGoogleSub: string,
): Promise<ClienteFichaAccessResult | null> {
  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome, email')
    .eq('clinica_email', ownerEmail)
    .eq('email', sessionEmail)
    .maybeSingle();

  if (medErr) {
    console.error('[clienteFichaAccess] medico email lookup:', medErr);
    return { allowed: false, reason: 'Erro ao verificar permissões' };
  }

  if (!medico?.id) return null;

  const { data: calRow, error: calErr } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('id, google_sub, connected_at, refresh_token_encrypted')
    .eq('clinica_medicos_id', medico.id)
    .maybeSingle();

  if (calErr) {
    console.error('[clienteFichaAccess] calendar email lookup:', calErr);
    return { allowed: false, reason: 'Erro ao verificar permissões' };
  }

  if (!calRow?.connected_at || !calRow.refresh_token_encrypted) return null;

  if (calRow.id) {
    await repairProfissionalGoogleSub({
      calendarRowId: calRow.id as string,
      storedSub: (calRow.google_sub as string | null) ?? null,
      sessionGoogleSub,
    });
  }

  return {
    allowed: true,
    role: 'equipe',
    nomeProfissional: String(medico.nome ?? '').trim() || 'Profissional',
  };
}

/** Titular do salão ou profissional de equipe com agenda conectada ao mesmo owner_email. */
export async function canAccessClienteFichaProfissional(params: {
  googleSub: string;
  sessionEmail: string;
  ownerEmail: string;
}): Promise<ClienteFichaAccessResult> {
  const sessionEmail = params.sessionEmail.toLowerCase().trim();
  const ownerEmail = params.ownerEmail.toLowerCase().trim();
  const googleSub = params.googleSub.trim();

  if (!sessionEmail || !ownerEmail) {
    return { allowed: false, reason: 'Sessão inválida' };
  }

  if (sessionEmail === ownerEmail) {
    return { allowed: true, role: 'titular' };
  }

  if (googleSub && !INVALID_GOOGLE_SUB.has(googleSub)) {
    const bySub = await accessByGoogleSub(googleSub, ownerEmail);
    if (bySub) return bySub;
  }

  if (googleSub) {
    const byEmail = await accessByMedicoEmail(sessionEmail, ownerEmail, googleSub);
    if (byEmail) return byEmail;
  }

  return {
    allowed: false,
    reason:
      `Você não tem permissão para ver esta ficha. Entre com o e-mail cadastrado na equipe (${sessionEmail}) e confirme que a Agenda Google está conectada no catálogo de profissionais.`,
  };
}
