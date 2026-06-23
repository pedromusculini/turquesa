import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { listGlobalInternalAudit } from '@/lib/internalOpsMonitor';

export async function GET(req: Request) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? '50');
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const action = url.searchParams.get('action') ?? undefined;

  try {
    const result = await listGlobalInternalAudit({ limit, offset, action: action ?? undefined });
    await logInternalAudit({
      adminEmail,
      action: 'view_monitor',
      productId,
      metadata: { section: 'audit_log', limit, offset, action },
    });
    return NextResponse.json({ ...result, product_id: productId });
  } catch (error) {
    console.error('[internal/audit-log]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
