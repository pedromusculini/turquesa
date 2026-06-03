import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { getInternalOverview } from '@/lib/internalMetrics';

export async function GET() {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  try {
    const overview = await getInternalOverview();
    await logInternalAudit({
      adminEmail,
      action: 'view_overview',
      productId,
    });
    return NextResponse.json({ overview, product_id: productId });
  } catch (error) {
    console.error('[internal/overview]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
