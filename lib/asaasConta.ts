import { PLANOS } from '@/lib/constants';
import { asaasRequest, type AsaasPayment, type AsaasListResponse } from '@/lib/asaasApi';
import {
  createRecurringCreditCardCheckout,
  type AsaasPaymentMethodChoice,
} from '@/lib/asaasCheckout';
import { getAssinaturaRow, ensureAssinaturaRecord } from '@/lib/assinatura';
import { cpfCnpjValidationMessage, normalizeCpfCnpj } from '@/lib/cpfCnpj';
import { getEffectivePrice } from '@/lib/subscriptionPricing';
import { supabaseAdmin } from '@/lib/supabaseClient';

export class AsaasBillingError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_CPF_CNPJ' | 'INVALID_CPF_CNPJ',
  ) {
    super(message);
    this.name = 'AsaasBillingError';
  }
}

type BillingProfile = {
  plan?: string | null;
  clinic_name?: string | null;
  full_name?: string | null;
  cnpj?: string | null;
};

async function loadBillingProfile(email: string): Promise<BillingProfile | null> {
  const { data } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('plan, clinic_name, full_name, cnpj')
    .eq('email', email)
    .maybeSingle();
  return data;
}

function requireBillingCpfCnpj(profile: BillingProfile | null): string {
  const raw = profile?.cnpj?.trim();
  if (!raw) {
    throw new AsaasBillingError(
      'Para gerar a cobrança, informe seu CPF ou CNPJ em Meu Perfil.',
      'MISSING_CPF_CNPJ',
    );
  }
  const digits = normalizeCpfCnpj(raw);
  const validationError = cpfCnpjValidationMessage(digits);
  if (validationError) {
    throw new AsaasBillingError(
      `${validationError} Atualize em Meu Perfil.`,
      'INVALID_CPF_CNPJ',
    );
  }
  return digits;
}

function resolveAsaasCustomerName(profile: BillingProfile | null, email: string): string {
  const label =
    profile?.clinic_name?.trim() ||
    profile?.full_name?.trim() ||
    email.split('@')[0] ||
    email;
  return `Turquesa Agenda — ${label}`;
}

/** Evita SMS/e-mail/correios automáticos do Asaas (cobrados à parte, ex. R$ 0,99/SMS). */
function buildAsaasCustomerPayload(
  profile: BillingProfile | null,
  email: string,
  cpfCnpj: string,
) {
  return {
    name: resolveAsaasCustomerName(profile, email),
    email,
    cpfCnpj,
    externalReference: email,
    notificationDisabled: true,
  };
}

const PENDING_STATUSES = new Set(['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS']);

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Primeira cobrança: fim do trial ou hoje se o trial já expirou. */
function resolveNextDueDate(trialEndsAt: string | null): string {
  const today = todayIsoDate();
  if (!trialEndsAt) {
    return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  }
  const trialDate = trialEndsAt.slice(0, 10);
  return trialDate < today ? today : trialDate;
}

function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return trialEndsAt.slice(0, 10) < todayIsoDate();
}

function pickPaymentUrl(pay: AsaasPayment): string | null {
  return pay.invoiceUrl || pay.bankSlipUrl || null;
}

async function listSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const res = await asaasRequest<AsaasListResponse<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments?limit=24`,
  );
  return res.data ?? [];
}

async function ensureAsaasCustomer(email: string): Promise<string> {
  const profile = await loadBillingProfile(email);
  const cpfCnpj = requireBillingCpfCnpj(profile);
  const payload = buildAsaasCustomerPayload(profile, email, cpfCnpj);
  const row = await getAssinaturaRow(email);

  if (row?.asaas_customer_id) {
    await asaasRequest(`/customers/${row.asaas_customer_id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return row.asaas_customer_id;
  }

  const created = await asaasRequest<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  await supabaseAdmin
    .from('assinaturas')
    .update({
      asaas_customer_id: created.id,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  return created.id;
}

async function syncAsaasSubscriptionValue(
  subscriptionId: string,
  targetValue: number,
): Promise<void> {
  const sub = await asaasRequest<{ value?: number }>(`/subscriptions/${subscriptionId}`);
  const current = Number(sub.value ?? 0);
  if (Math.abs(current - targetValue) < 0.01) return;

  await asaasRequest(`/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    body: JSON.stringify({ value: targetValue }),
  });
}

async function ensureAsaasSubscription(
  email: string,
  plano: string,
  trialEndsAt: string | null,
  billingType: 'PIX' | 'CREDIT_CARD' = 'PIX',
): Promise<string> {
  const row = await getAssinaturaRow(email);
  const { price } = await getEffectivePrice(email);
  const description = `Turquesa Agenda — ${PLANOS[plano as keyof typeof PLANOS]?.nome ?? plano}`;

  if (row?.asaas_subscription_id) {
    await asaasRequest(`/subscriptions/${row.asaas_subscription_id}`, {
      method: 'PUT',
      body: JSON.stringify({ billingType, value: price, description }),
    });
    await syncAsaasSubscriptionValue(row.asaas_subscription_id, price);
    return row.asaas_subscription_id;
  }

  const customerId = await ensureAsaasCustomer(email);
  const nextDueDate = resolveNextDueDate(trialEndsAt);

  const subscription = await asaasRequest<{ id: string }>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value: price,
      cycle: 'MONTHLY',
      nextDueDate,
      description,
      externalReference: email,
    }),
  });

  await supabaseAdmin
    .from('assinaturas')
    .update({
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  return subscription.id;
}

async function createImmediateSubscriptionPayment(
  email: string,
  subscriptionId: string,
  customerId: string,
  value: number,
  plano: string,
): Promise<AsaasPayment | null> {
  const dueDate = todayIsoDate();
  const created = await asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value,
      dueDate,
      subscription: subscriptionId,
      externalReference: email,
      description: `Turquesa Agenda — ${PLANOS[plano as keyof typeof PLANOS]?.nome ?? plano}`,
    }),
  });
  return created?.id ? created : null;
}

async function resolvePixPaymentLink(
  email: string,
  plano: string,
  trialEndsAt: string | null,
): Promise<AsaasPayment | null> {
  const subscriptionId = await ensureAsaasSubscription(email, plano, trialEndsAt, 'PIX');
  const row = await getAssinaturaRow(email);
  const { price } = await getEffectivePrice(email);

  let payments = await listSubscriptionPayments(subscriptionId);
  let open = payments.filter((p) => PENDING_STATUSES.has(p.status ?? ''));
  let target = open.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];

  if (!target && isTrialExpired(trialEndsAt)) {
    const customerId = row?.asaas_customer_id;
    if (customerId) {
      try {
        const created = await createImmediateSubscriptionPayment(
          email,
          subscriptionId,
          customerId,
          price,
          plano,
        );
        if (created) {
          target = created;
        } else {
          payments = await listSubscriptionPayments(subscriptionId);
          open = payments.filter((p) => PENDING_STATUSES.has(p.status ?? ''));
          target = open.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];
        }
      } catch (err) {
        console.error('[asaasConta] createImmediateSubscriptionPayment', err);
      }
    }
  }

  return target ?? null;
}

export type PagamentoLinkResult = {
  ok: boolean;
  url?: string;
  message: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentMethod?: AsaasPaymentMethodChoice;
  code?: string;
};

/**
 * Retorna URL de pagamento Asaas (checkout cartão recorrente ou fatura PIX).
 */
export async function getPagamentoLinkForOwner(
  ownerEmail: string,
  options?: { method?: AsaasPaymentMethodChoice },
): Promise<PagamentoLinkResult> {
  const email = ownerEmail.toLowerCase().trim();
  const method = options?.method;
  if (!method) {
    return {
      ok: false,
      code: 'PAYMENT_METHOD_REQUIRED',
      message: 'Escolha cartão (renovação automática) ou PIX.',
    };
  }

  await ensureAssinaturaRecord(email);
  const row = await getAssinaturaRow(email);
  if (!row) {
    return { ok: false, message: 'Conta de assinatura não encontrada.' };
  }

  await ensureAsaasCustomer(email);
  const { price } = await getEffectivePrice(email);
  const planName = PLANOS[row.plano as keyof typeof PLANOS]?.nome ?? row.plano;
  const nextDueDate = resolveNextDueDate(row.trial_ends_at);

  if (method === 'CREDIT_CARD') {
    const url = await createRecurringCreditCardCheckout({
      email,
      value: price,
      nextDueDate,
      planDescription: `Turquesa Agenda — ${planName}`,
    });
    return {
      ok: true,
      url,
      paymentMethod: 'CREDIT_CARD',
      message: 'Abra o checkout seguro do Asaas para cadastrar o cartão (cobrança mensal automática, à vista).',
    };
  }

  const target = await resolvePixPaymentLink(email, row.plano, row.trial_ends_at);
  if (target) {
    const url = pickPaymentUrl(target);
    if (url) {
      return {
        ok: true,
        url,
        paymentId: target.id,
        paymentStatus: target.status,
        paymentMethod: 'PIX',
        message: 'Abra o link para pagar com PIX. Todo mês será gerada uma nova cobrança PIX.',
      };
    }
  }

  const subscriptionId = await ensureAsaasSubscription(email, row.plano, row.trial_ends_at, 'PIX');
  const payments = await listSubscriptionPayments(subscriptionId);
  const last = payments[payments.length - 1];
  if (last?.status === 'RECEIVED' || last?.status === 'CONFIRMED') {
    return {
      ok: false,
      message:
        'Não há cobrança PIX em aberto. Se o acesso ainda estiver bloqueado, aguarde alguns minutos após o pagamento ou entre em contato com o suporte.',
    };
  }

  return {
    ok: false,
    message:
      'A cobrança PIX ainda não foi gerada pelo Asaas. Tente novamente em algumas horas ou no dia do vencimento.',
  };
}
