import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { getInternalTenantDetail } from '@/lib/internalMetrics';
import { listInternalAuditForTenant } from '@/lib/internalAuditLog';
import { listInternalTenantNotes } from '@/lib/internalTenantNotes';

type RouteContext = { params: Promise<{ email: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const { email: raw } = await context.params;
  const ownerEmail = decodeURIComponent(raw).toLowerCase().trim();

  try {
    const tenant = await getInternalTenantDetail(ownerEmail);
    if (!tenant) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await logInternalAudit({
      adminEmail,
      action: 'view_tenant',
      productId,
      targetOwnerEmail: ownerEmail,
    });
    const [notes, audit_log] = await Promise.all([
      listInternalTenantNotes(ownerEmail),
      listInternalAuditForTenant(ownerEmail),
    ]);

    return NextResponse.json({ tenant, notes, audit_log, product_id: productId });
  } catch (error) {
    console.error('[internal/tenants/email]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
