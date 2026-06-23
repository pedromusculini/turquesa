import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { extendTenantTrial } from '@/lib/internalBilling';

type RouteContext = { params: Promise<{ email: string }> };

export async function POST(req: Request, context: RouteContext) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const { email: raw } = await context.params;
  const ownerEmail = decodeURIComponent(raw).toLowerCase().trim();

  let body: { days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const days = Number(body.days ?? 7);
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    return NextResponse.json({ error: 'Dias deve ser entre 1 e 30' }, { status: 400 });
  }

  try {
    const result = await extendTenantTrial({ ownerEmail, extraDays: days });
    await logInternalAudit({
      adminEmail,
      action: 'extend_trial',
      productId,
      targetOwnerEmail: ownerEmail,
      metadata: { extra_days: days, trial_ends_at: result.trial_ends_at },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[internal/extend-trial]', error);
    const message = error instanceof Error ? error.message : 'Erro';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
