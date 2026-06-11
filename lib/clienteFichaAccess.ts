import { supabaseAdmin } from '@/lib/supabaseClient';

export type ClienteFichaAccessResult =
  | { allowed: true; role: 'titular' | 'equipe'; nomeProfissional?: string }
  | { allowed: false; reason: string };

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

/** Titular do salão ou profissional de equipe com agenda conectada ao mesmo owner_email. */
export async function canAccessClienteFichaProfissional(params: {
  googleSub: string;
  sessionEmail: string;
  ownerEmail: string;
}): Promise<ClienteFichaAccessResult> {
  const sessionEmail = params.sessionEmail.toLowerCase().trim();
  const ownerEmail = params.ownerEmail.toLowerCase().trim();
  const googleSub = params.googleSub.trim();

  if (!googleSub || !sessionEmail || !ownerEmail) {
    return { allowed: false, reason: 'Sessão inválida' };
  }

  if (sessionEmail === ownerEmail) {
    return { allowed: true, role: 'titular' };
  }

  const { data: calRows, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('clinica_medicos_id, connected_at')
    .eq('google_sub', googleSub)
    .not('connected_at', 'is', null);

  if (error) {
    console.error('[clienteFichaAccess] calendar lookup:', error);
    return { allowed: false, reason: 'Erro ao verificar permissões' };
  }

  if (!calRows?.length) {
    return { allowed: false, reason: 'Você não tem permissão para ver esta ficha' };
  }

  const medicoIds = calRows
    .map((row) => row.clinica_medicos_id)
    .filter((id): id is string | number => id != null);

  if (!medicoIds.length) {
    return { allowed: false, reason: 'Você não tem permissão para ver esta ficha' };
  }

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
  if (!medico) {
    return { allowed: false, reason: 'Você não tem permissão para ver esta ficha' };
  }

  return {
    allowed: true,
    role: 'equipe',
    nomeProfissional: String(medico.nome ?? '').trim() || 'Profissional',
  };
}
