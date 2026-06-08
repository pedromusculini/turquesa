import { PLANOS } from '@/lib/constants';
import { getInternalProductId } from '@/lib/internalProduct';
import { supabaseAdmin } from '@/lib/supabaseClient';

type PriceLockRow = {
  locked_price?: number | string | null;
  price_locked_until?: string | null;
};

export function isMissingPriceLockColumnError(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    msg.includes('locked_price') ||
    msg.includes('price_locked_until')
  );
}

async function loadPriceLockRow(ownerEmail: string): Promise<PriceLockRow | null> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('assinaturas')
    .select('locked_price, price_locked_until')
    .eq('owner_email', email)
    .maybeSingle();
  if (error) {
    if (isMissingPriceLockColumnError(error)) return null;
    throw error;
  }
  return data as PriceLockRow | null;
}

/** Contrato comercial: preço garantido por 12 meses a partir do cadastro. */
export const PRICE_LOCK_MONTHS = 12;

export const DEFAULT_LIST_PRICE = PLANOS.ilimitado.valor;

export type EffectivePrice = {
  price: number;
  listPrice: number;
  isLocked: boolean;
  lockedUntil: string | null;
  lockedPrice: number | null;
};

export function computePriceLockedUntil(base: Date): string {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + PRICE_LOCK_MONTHS);
  return d.toISOString();
}

export async function getCurrentListPrice(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_billing_config')
      .select('current_list_price')
      .eq('product_id', getInternalProductId())
      .maybeSingle();
    if (!error && data?.current_list_price != null) {
      return Number(data.current_list_price);
    }
  } catch {
    /* tabela ainda não migrada */
  }
  return DEFAULT_LIST_PRICE;
}

export async function setCurrentListPrice(
  price: number,
  adminEmail: string,
): Promise<{ listPrice: number }> {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Preço inválido.');
  }
  const rounded = Math.round(price * 100) / 100;
  const productId = getInternalProductId();
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('subscription_billing_config').upsert(
    {
      product_id: productId,
      current_list_price: rounded,
      updated_at: now,
      updated_by: adminEmail,
    },
    { onConflict: 'product_id' },
  );
  if (error) throw error;
  return { listPrice: rounded };
}

export async function getEffectivePrice(ownerEmail: string): Promise<EffectivePrice> {
  const email = ownerEmail.toLowerCase().trim();
  const listPrice = await getCurrentListPrice();
  const row = await loadPriceLockRow(email);

  if (!row?.locked_price) {
    return {
      price: listPrice,
      listPrice,
      isLocked: false,
      lockedUntil: row?.price_locked_until ?? null,
      lockedPrice: null,
    };
  }

  const lockedPrice = Number(row.locked_price);
  const lockedUntil = row.price_locked_until ?? null;
  const stillLocked =
    lockedUntil != null && new Date(lockedUntil).getTime() > Date.now();

  return {
    price: stillLocked ? lockedPrice : listPrice,
    listPrice,
    isLocked: stillLocked,
    lockedUntil,
    lockedPrice,
  };
}

/** Garante preço travado ao criar registro de assinatura (novos cadastros). */
export async function assignPriceLockOnSignup(ownerEmail: string): Promise<void> {
  const email = ownerEmail.toLowerCase().trim();
  const row = await loadPriceLockRow(email);
  if (!row || row.locked_price != null) return;

  const listPrice = await getCurrentListPrice();
  const now = new Date();
  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      locked_price: listPrice,
      price_locked_until: computePriceLockedUntil(now),
      updated_at: now.toISOString(),
    })
    .eq('owner_email', email);
  if (error && !isMissingPriceLockColumnError(error)) throw error;
}

/** Renova garantia de preço após expiração do contrato de 12 meses (novo ciclo). */
export async function renewPriceLockAfterExpiry(ownerEmail: string): Promise<void> {
  const email = ownerEmail.toLowerCase().trim();
  const row = await loadPriceLockRow(email);
  if (!row?.price_locked_until) return;

  if (new Date(row.price_locked_until).getTime() > Date.now()) return;

  const listPrice = await getCurrentListPrice();
  const now = new Date();
  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      locked_price: listPrice,
      price_locked_until: computePriceLockedUntil(now),
      updated_at: now.toISOString(),
    })
    .eq('owner_email', email);
  if (error && !isMissingPriceLockColumnError(error)) throw error;
}
