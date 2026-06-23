import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { listInternalTenants } from '@/lib/internalMetrics';

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') ?? 'all';
  const q = url.searchParams.get('q') ?? '';

  try {
    const { tenants } = await listInternalTenants({
      q: q || undefined,
      filter,
      limit: 500,
      offset: 0,
    });

    const header = [
      'email',
      'display_name',
      'plan',
      'billing_status',
      'trial_ends_at',
      'email_verified',
      'onboarding_completed',
      'last_login_at',
      'clientes',
      'atendimentos',
      'ativado',
    ].join(',');

    const lines = tenants.map((t) =>
      [
        csvEscape(t.email),
        csvEscape(t.display_name),
        csvEscape(t.plan),
        csvEscape(t.billing.status),
        csvEscape(t.billing.trial_ends_at),
        csvEscape(t.email_verified),
        csvEscape(t.onboarding_completed),
        csvEscape(t.last_login_at),
        csvEscape(t.counts.clientes),
        csvEscape(t.counts.consultas_agenda),
        csvEscape(t.health.ativado),
      ].join(','),
    );

    await logInternalAudit({
      adminEmail,
      action: 'export_tenants',
      productId,
      metadata: { rows: tenants.length, filter, q: q || null },
    });

    const csv = [header, ...lines].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="contas-${productId}.csv"`,
      },
    });
  } catch (error) {
    console.error('[internal/tenants/export]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
