import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import {
  getCurrentListPrice,
  setCurrentListPrice,
  PRICE_LOCK_MONTHS,
} from '@/lib/subscriptionPricing';

export async function GET() {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  try {
    const listPrice = await getCurrentListPrice();
    await logInternalAudit({
      adminEmail,
      action: 'view_pricing',
      productId,
    });
    return NextResponse.json({
      list_price: listPrice,
      price_lock_months: PRICE_LOCK_MONTHS,
      product_id: productId,
    });
  } catch (error) {
    console.error('[internal/pricing GET]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  try {
    const body = await request.json();
    const raw = body?.list_price ?? body?.listPrice;
    const price = typeof raw === 'string' ? parseFloat(raw.replace(',', '.')) : Number(raw);

    const { listPrice } = await setCurrentListPrice(price, adminEmail);
    await logInternalAudit({
      adminEmail,
      action: 'update_list_price',
      productId,
      metadata: { list_price: listPrice },
    });
    return NextResponse.json({
      ok: true,
      list_price: listPrice,
      price_lock_months: PRICE_LOCK_MONTHS,
    });
  } catch (error) {
    console.error('[internal/pricing PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar preço.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
