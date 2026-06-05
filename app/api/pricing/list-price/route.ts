import { NextResponse } from 'next/server';
import { getCurrentListPrice, PRICE_LOCK_MONTHS } from '@/lib/subscriptionPricing';

/** Preço de tabela público (landing / planos). */
export async function GET() {
  try {
    const listPrice = await getCurrentListPrice();
    return NextResponse.json({
      list_price: listPrice,
      price_lock_months: PRICE_LOCK_MONTHS,
    });
  } catch (error) {
    console.error('[pricing/list-price]', error);
    return NextResponse.json({ error: 'Indisponível' }, { status: 503 });
  }
}
