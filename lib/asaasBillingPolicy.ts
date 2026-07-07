/**
 * Regras de cobrança Turquesa Agenda (fonte única para webhook + evaluateAccess).
 * Único benefício: 30 dias grátis no primeiro acesso. Sem tolerância extra.
 */

export const TRIAL_DAYS = 30;

/** Cada pagamento confirmado (webhook) libera este período de acesso. */
export const PAID_PERIOD_DAYS = 30;

/** Dia do trial (1-based) em que o usuário deve cadastrar pagamento no Asaas. */
export const TRIAL_PAYMENT_DAY = 29;

/** Renovação mensal via boleto: tolerância só após o vencimento, até compensar. */
export const BOLETO_RENEWAL_GRACE_DAYS = 3;

export type AsaasBillingType =
  | 'BOLETO'
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'TRANSFER'
  | 'UNDEFINED'
  | string;

export function normalizeBillingType(raw?: string | null): AsaasBillingType | null {
  if (!raw?.trim()) return null;
  return raw.trim().toUpperCase() as AsaasBillingType;
}

export function isBoleto(billingType: AsaasBillingType | null): boolean {
  return billingType === 'BOLETO';
}

export function hasCompletedFirstPayment(row: {
  first_payment_at?: string | null;
  last_payment_at?: string | null;
}): boolean {
  return Boolean(row.first_payment_at || row.last_payment_at);
}

/** Eventos que podem ativar acesso (sempre validar billingType para boleto). */
export function shouldActivateSubscription(params: {
  event: string;
  billingType: AsaasBillingType | null;
  hasFirstPayment: boolean;
}): boolean {
  const { event, billingType, hasFirstPayment } = params;
  const boleto = isBoleto(billingType);

  if (event === 'PAYMENT_RECEIVED') {
    return true;
  }

  if (event === 'PAYMENT_CONFIRMED') {
    if (boleto && !hasFirstPayment) {
      return false;
    }
    return true;
  }

  return false;
}

/** Eventos que podem revogar acesso (validar contexto com shouldExpireFromWebhook). */
export function shouldExpireSubscription(event: string): boolean {
  return (
    event === 'PAYMENT_OVERDUE' ||
    event === 'PAYMENT_DELETED' ||
    event === 'PAYMENT_REFUNDED' ||
    event === 'PAYMENT_CHARGEBACK' ||
    event === 'SUBSCRIPTION_INACTIVATED' ||
    event === 'SUBSCRIPTION_DELETED'
  );
}

type ExpireWebhookRow = {
  asaas_subscription_id?: string | null;
  current_period_end?: string | null;
  last_asaas_payment_id?: string | null;
  boleto_grace_until?: string | null;
};

/**
 * Evita expirar por cobrança órfã (ex.: assinatura de teste duplicada no Asaas)
 * ou enquanto o período pago ainda é válido.
 */
export function shouldExpireFromWebhook(params: {
  event: string;
  row: ExpireWebhookRow | null;
  paymentId?: string | null;
  paymentSubscriptionId?: string | null;
  webhookSubscriptionId?: string | null;
  now?: Date;
}): boolean {
  const { event, row } = params;
  if (!shouldExpireSubscription(event)) return false;
  if (!row) return true;

  const now = params.now ?? new Date();
  const linkedSub = row.asaas_subscription_id?.trim() || null;

  if (event === 'PAYMENT_OVERDUE') {
    const paySub = params.paymentSubscriptionId?.trim() || null;
    if (linkedSub && paySub && paySub !== linkedSub) {
      return false;
    }
    if (row.current_period_end && new Date(row.current_period_end).getTime() > now.getTime()) {
      return false;
    }
    if (
      row.boleto_grace_until &&
      new Date(row.boleto_grace_until).getTime() > now.getTime()
    ) {
      return false;
    }
    return true;
  }

  if (
    event === 'PAYMENT_REFUNDED' ||
    event === 'PAYMENT_CHARGEBACK' ||
    event === 'PAYMENT_DELETED'
  ) {
    const payId = params.paymentId?.trim() || null;
    const lastPay = row.last_asaas_payment_id?.trim() || null;
    if (payId && lastPay && payId !== lastPay) {
      return false;
    }
    const paySub = params.paymentSubscriptionId?.trim() || null;
    if (linkedSub && paySub && paySub !== linkedSub) {
      return false;
    }
    if (row.current_period_end && new Date(row.current_period_end).getTime() > now.getTime()) {
      if (payId && lastPay && payId !== lastPay) {
        return false;
      }
    }
    return true;
  }

  if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'SUBSCRIPTION_DELETED') {
    const webhookSub = params.webhookSubscriptionId?.trim() || null;
    if (linkedSub && webhookSub && webhookSub !== linkedSub) {
      return false;
    }
    return true;
  }

  return true;
}

export function hasValidPaidPeriod(
  row: { current_period_end?: string | null; last_payment_at?: string | null },
  now = new Date(),
): boolean {
  if (!row.last_payment_at || !row.current_period_end) return false;
  return new Date(row.current_period_end).getTime() > now.getTime();
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString();
}

/** Fim da tolerância de boleto na renovação (dueDate + 3 dias). Primeiro pagamento: sem tolerância. */
export function computeBoletoGraceUntil(params: {
  dueDate: string | null;
  billingType: AsaasBillingType | null;
  isFirstPayment: boolean;
}): string | null {
  if (params.isFirstPayment || !isBoleto(params.billingType) || !params.dueDate) {
    return null;
  }
  return addDaysToDateString(params.dueDate, BOLETO_RENEWAL_GRACE_DAYS);
}

export function trialDayNumber(trialStartedAt: Date, now = new Date()): number {
  const start = new Date(trialStartedAt);
  start.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

export function isTrialPaymentWindow(trialEndsAt: string | null, now = new Date()): boolean {
  if (!trialEndsAt) return false;
  const end = new Date(trialEndsAt).getTime();
  if (now.getTime() >= end) return false;
  const daysLeft = Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
  return daysLeft <= 2;
}

export type BillingUserMessage = {
  trialPaymentDue: boolean;
  boletoFirstPaymentWarning: boolean;
  boletoRenewalGraceWarning: boolean;
  graceEndsAt: string | null;
};

export function getBillingUserMessages(params: {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  boleto_grace_until: string | null;
  last_billing_type: string | null;
  first_payment_at: string | null;
  now?: Date;
}): BillingUserMessage {
  const now = params.now ?? new Date();
  const boleto = isBoleto(normalizeBillingType(params.last_billing_type));
  const trialPaymentDue =
    params.status === 'trial' && isTrialPaymentWindow(params.trial_ends_at, now);

  const boletoFirstPaymentWarning =
    params.status === 'expired' && !params.first_payment_at;

  const inGrace =
    params.status === 'active' &&
    boleto &&
    params.boleto_grace_until &&
    now.getTime() >= new Date(params.current_period_end ?? 0).getTime() &&
    now.getTime() < new Date(params.boleto_grace_until).getTime();

  return {
    trialPaymentDue,
    boletoFirstPaymentWarning,
    boletoRenewalGraceWarning: Boolean(inGrace),
    graceEndsAt: inGrace ? params.boleto_grace_until : null,
  };
}
