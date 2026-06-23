import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { listBugReports } from '@/lib/internalOpsMonitor';

export async function GET(req: Request) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? '25');
  const offset = Number(url.searchParams.get('offset') ?? '0');

  try {
    const result = await listBugReports({ limit, offset });
    await logInternalAudit({
      adminEmail,
      action: 'view_bug_reports',
      productId,
      metadata: { limit, offset },
    });
    return NextResponse.json({ ...result, product_id: productId });
  } catch (error) {
    console.error('[internal/bug-reports]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
