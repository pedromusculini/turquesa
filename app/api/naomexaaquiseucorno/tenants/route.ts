import { NextRequest, NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { listInternalTenants } from '@/lib/internalMetrics';

export async function GET(req: NextRequest) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? undefined;
  const limit = Number(searchParams.get('limit') || 50);
  const offset = Number(searchParams.get('offset') || 0);
  const filter = searchParams.get('filter') ?? undefined;

  try {
    const result = await listInternalTenants({ q, limit, offset, filter });
    await logInternalAudit({
      adminEmail,
      action: 'list_tenants',
      productId,
      metadata: { q: q ?? null, limit, offset },
    });
    return NextResponse.json({ ...result, product_id: productId });
  } catch (error) {
    console.error('[internal/tenants]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
