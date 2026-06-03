/**
 * Cliente HTTP Asaas (somente server-side).
 */
export type AsaasPayment = {
  id: string;
  status?: string;
  dueDate?: string;
  value?: number;
  billingType?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  invoiceNumber?: string | null;
};

export type AsaasListResponse<T> = {
  data?: T[];
  totalCount?: number;
};

function getConfig() {
  const base = process.env.ASAAS_API_URL?.replace(/\/$/, '') || 'https://api.asaas.com/v3';
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) {
    throw new Error('ASAAS_API_KEY não configurada no servidor');
  }
  return { base, key };
}

export function isAsaasApiConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY?.trim() && process.env.ASAAS_API_URL?.trim());
}

export async function asaasRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { base, key } = getConfig();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data: T & { errors?: { description?: string }[] };
  try {
    data = text ? JSON.parse(text) : ({} as T);
  } catch {
    throw new Error(`Asaas resposta inválida (${res.status})`);
  }

  if (!res.ok) {
    const msg =
      (data as { errors?: { description?: string }[] }).errors?.[0]?.description ||
      (data as { message?: string }).message ||
      res.statusText;
    throw new Error(`Asaas ${res.status}: ${msg}`);
  }

  return data;
}
