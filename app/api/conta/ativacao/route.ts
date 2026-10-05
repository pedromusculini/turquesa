import { NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { getSubscriptionAccess } from '@/lib/assinatura';
import { getAtivacaoResumo } from '@/lib/ativacaoSalao';

export const runtime = 'nodejs';

/** Progresso de ativação + dados do trial (checklist do painel e resumo antes de assinar). */
export async function GET() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const access = await getSubscriptionAccess(email);
    const resumo = await getAtivacaoResumo(email, { trialEndsAt: access.trial_ends_at });
    return NextResponse.json({
      resumo,
      subscription: {
        status: access.status,
        trial_ends_at: access.trial_ends_at,
        daysLeftTrial: access.daysLeftTrial,
        first_payment_at: access.first_payment_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar ativação';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
