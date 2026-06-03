import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import {
  removeTenantGoogleAccessRecord,
  resetTenantEmailVerification,
} from '@/lib/internalAccountActions';

type RouteContext = { params: Promise<{ email: string }> };

export async function POST(req: Request, context: RouteContext) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const { email: raw } = await context.params;
  const ownerEmail = decodeURIComponent(raw).toLowerCase().trim();

  let mode: 'reverify' | 'remove' = 'reverify';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === 'remove') mode = 'remove';
  } catch {
    /* default reverify */
  }

  try {
    const result =
      mode === 'remove'
        ? await removeTenantGoogleAccessRecord(ownerEmail)
        : await resetTenantEmailVerification(ownerEmail);

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    await logInternalAudit({
      adminEmail,
      action:
        mode === 'remove' ? 'remove_tenant_google_access' : 'reset_tenant_access',
      productId,
      targetOwnerEmail: ownerEmail,
      metadata: { mode, google_sub: result.google_sub },
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error('[internal/reset-access]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
