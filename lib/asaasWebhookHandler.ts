import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  activateFromPayment,
  expireAssinatura,
  getAssinaturaRow,
} from '@/lib/assinatura';
import type { AsaasWebhookPayload } from '@/lib/asaasWebhook';
import {
  normalizeBillingType,
  shouldActivateSubscription,
  shouldExpireFromWebhook,
  shouldExpireSubscription,
  isBoleto,
  computeBoletoGraceUntil,
  hasCompletedFirstPayment,
} from '@/lib/asaasBillingPolicy';

function resolveOwnerEmail(body: AsaasWebhookPayload): string | null {
  const ref =
    body.payment?.externalReference?.trim() ||
    body.subscription?.externalReference?.trim();
  if (ref && ref.includes('@')) return ref.toLowerCase();
  return null;
}

export async function processAsaasWebhook(
  body: AsaasWebhookPayload,
  rawPayload: unknown,
): Promise<{ handled: boolean; ownerEmail?: string; skipped?: string }> {
  const eventId = (body as { id?: string }).id;
  const event = body.event ?? '';
  const ownerEmail = resolveOwnerEmail(body);

  if (eventId) {
    const { error: insErr } = await supabaseAdmin
      .from('assinaturas_webhook_events')
      .insert({
        asaas_event_id: eventId,
        event_type: event,
        owner_email: ownerEmail,
        asaas_payment_id: body.payment?.id ?? null,
        payload: rawPayload as Record<string, unknown>,
      });
    if (insErr?.code === '23505') {
      return { handled: true, ownerEmail: ownerEmail ?? undefined };
    }
    if (insErr) throw insErr;
  }

  if (!ownerEmail) {
    console.warn('[asaasWebhook] Sem externalReference (e-mail):', event);
    return { handled: false };
  }

  const billingType = normalizeBillingType(body.payment?.billingType);
  const row = await getAssinaturaRow(ownerEmail);
  const hadFirstPayment = hasCompletedFirstPayment(row ?? {});

  if (shouldActivateSubscription({ event, billingType, hasFirstPayment: hadFirstPayment })) {
    const isFirst = !hadFirstPayment;
    await activateFromPayment({
      ownerEmail,
      paymentId: body.payment?.id ?? eventId ?? 'unknown',
      dueDate: body.payment?.dueDate ?? null,
      customerId: body.payment?.customer ?? null,
      subscriptionId: body.payment?.subscription ?? null,
      billingType,
      isFirstPayment: isFirst,
    });
    return { handled: true, ownerEmail };
  }

  if (event === 'PAYMENT_CONFIRMED' && isBoleto(billingType) && !hadFirstPayment) {
    console.info(
      '[asaasWebhook] PAYMENT_CONFIRMED boleto (1º pagamento) ignorado — aguardando compensação (PAYMENT_RECEIVED)',
      ownerEmail,
    );
    return {
      handled: true,
      ownerEmail,
      skipped: 'boleto_first_payment_await_received',
    };
  }

  if (
    shouldExpireFromWebhook({
      event,
      row,
      paymentId: body.payment?.id ?? null,
      paymentSubscriptionId: body.payment?.subscription ?? null,
      webhookSubscriptionId: body.subscription?.id ?? null,
    })
  ) {
    await expireAssinatura(ownerEmail);
    return { handled: true, ownerEmail };
  }

  if (shouldExpireSubscription(event)) {
    console.info('[asaasWebhook] Expiração ignorada — cobrança/assinatura não vinculada ou período pago válido', {
      event,
      ownerEmail,
      paymentId: body.payment?.id,
      paymentSubscription: body.payment?.subscription,
      linkedSubscription: row?.asaas_subscription_id,
      currentPeriodEnd: row?.current_period_end,
    });
    return {
      handled: true,
      ownerEmail,
      skipped: 'expire_not_applicable',
    };
  }

  return { handled: false, ownerEmail };
}
