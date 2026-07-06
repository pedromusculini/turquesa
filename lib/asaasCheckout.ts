import { readFileSync } from 'fs';
import { join } from 'path';
import { asaasRequest } from '@/lib/asaasApi';
import { CANONICAL_APP_URL } from '@/lib/constants';

export type AsaasPaymentMethodChoice = 'CREDIT_CARD' | 'PIX';

const CHECKOUT_ITEM_NAME = 'Turquesa Agenda Ilimitado';
const LOGO_PATH = join(
  process.cwd(),
  'public/portfolio-logos/logo-hero-turquesa-agenda-pro-transparent.png',
);

function readCheckoutLogoBase64(): string | undefined {
  try {
    return readFileSync(LOGO_PATH).toString('base64');
  } catch {
    return undefined;
  }
}

/** Checkout recorrente: só cartão à vista (sem boleto, sem parcelamento). */
export async function createRecurringCreditCardCheckout(params: {
  email: string;
  value: number;
  nextDueDate: string;
  planDescription: string;
}): Promise<string> {
  const item: Record<string, unknown> = {
    name: CHECKOUT_ITEM_NAME,
    description: params.planDescription.slice(0, 150),
    quantity: 1,
    value: params.value,
  };
  const logo = readCheckoutLogoBase64();
  if (logo) item.imageBase64 = logo;

  const checkout = await asaasRequest<{ link?: string }>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 1440,
      externalReference: params.email,
      callback: {
        successUrl: `${CANONICAL_APP_URL}/dashboard/conta?pagamento=ok`,
        cancelUrl: `${CANONICAL_APP_URL}/renovar?pagamento=cancelado`,
        expiredUrl: `${CANONICAL_APP_URL}/renovar?pagamento=expirado`,
      },
      items: [item],
      subscription: {
        cycle: 'MONTHLY',
        nextDueDate: params.nextDueDate,
      },
    }),
  });

  if (!checkout.link) {
    throw new Error('Asaas não retornou link do checkout');
  }
  return checkout.link;
}
