import { timingSafeEqual } from 'crypto';

export type AsaasWebhookPayload = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    dueDate?: string;
    billingType?: string | null;
    externalReference?: string | null;
    subscription?: string | null;
    customer?: string;
  };
  subscription?: {
    id?: string;
    status?: string;
    externalReference?: string | null;
    customer?: string;
  };
};

export function verifyAsaasWebhookToken(
  headerToken: string | null,
  expectedToken: string | undefined,
): { ok: boolean; reason?: string } {
  if (!expectedToken?.trim()) {
    return { ok: false, reason: 'ASAAS_WEBHOOK_TOKEN não configurado no servidor' };
  }
  if (!headerToken?.trim()) {
    return { ok: false, reason: 'Header asaas-access-token ausente' };
  }
  const a = Buffer.from(headerToken.trim());
  const b = Buffer.from(expectedToken.trim());
  if (a.length !== b.length) {
    return { ok: false, reason: 'Token inválido' };
  }
  if (!timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Token inválido' };
  }
  return { ok: true };
}

/** Resumo legível para logs em desenvolvimento / homologação. */
export function summarizeAsaasWebhook(body: AsaasWebhookPayload): string {
  const event = body.event ?? 'UNKNOWN';
  const pay = body.payment;
  const sub = body.subscription;
  const parts = [`event=${event}`];
  if (pay?.id) parts.push(`payment=${pay.id}`);
  if (pay?.status) parts.push(`status=${pay.status}`);
  if (pay?.externalReference) parts.push(`ref=${pay.externalReference}`);
  if (pay?.subscription) parts.push(`subscription=${pay.subscription}`);
  if (sub?.id) parts.push(`subscription=${sub.id}`);
  return parts.join(' ');
}
