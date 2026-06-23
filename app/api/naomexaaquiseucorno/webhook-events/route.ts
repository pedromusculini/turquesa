import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { listRecentWebhookEvents } from '@/lib/internalOpsMonitor';

export async function GET(req: Request) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? '50');

  try {
    const events = await listRecentWebhookEvents(limit);
    await logInternalAudit({
      adminEmail,
      action: 'view_monitor',
      productId,
      metadata: { section: 'webhook_events', limit },
    });
    return NextResponse.json({ events, product_id: productId });
  } catch (error) {
    console.error('[internal/webhook-events]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
