'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CreditCard, Download, ExternalLink, Loader2, LogOut } from 'lucide-react';
import { CANONICAL_APP_URL, PRODUCT_NAME } from '@/lib/constants';

type ContaResponse = {
  subscription: {
    status: string;
    canUseApp: boolean;
    trial_ends_at: string | null;
    current_period_end: string | null;
    first_payment_at: string | null;
  };
  profile: {
    plan_name: string;
    plan_value: number | null;
  };
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function RenovarAssinaturaClient() {
  const router = useRouter();
  const [data, setData] = useState<ContaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    fetch('/api/conta')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          const err = new Error(json.error || 'Erro ao carregar') as Error & { code?: string };
          err.code = json.code;
          throw err;
        }
        return json as ContaResponse;
      })
      .then((json) => {
        if (json.subscription.canUseApp) {
          router.replace('/dashboard');
          return;
        }
        setData(json);
      })
      .catch((e) => {
        const err = e as Error & { code?: string };
        if (err.code === 'ONBOARDING_REQUIRED') {
          router.replace('/onboarding');
          return;
        }
        setError(err.message || 'Erro ao carregar');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function openPagamentoAsaas() {
    setPayLoading(true);
    setPayError('');
    try {
      const res = await fetch('/api/conta/pagamento');
      const json = await res.json();
      if (!json.ok || !json.url) {
        throw new Error(json.message || 'Não foi possível abrir o pagamento');
      }
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Erro ao abrir pagamento');
    } finally {
      setPayLoading(false);
    }
  }

  async function handleSignOut() {
    const { signOut } = await import('next-auth/react');
    await signOut({ callbackUrl: '/login' });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg-page)]">
        <Loader2 className="h-8 w-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg-page)] px-4">
        <div className="max-w-md text-center">
          <p className="text-red-600">{error || 'Não foi possível carregar'}</p>
          <Link href="/login" className="mt-4 inline-block text-[#047482] underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  const { subscription: sub, profile } = data;
  const periodEnd = sub.current_period_end ?? sub.trial_ends_at;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D9F0F2]/60 to-[var(--brand-bg-page)] px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#047482]">
            {PRODUCT_NAME}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Renovar acesso</h1>
        </div>

        <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-950 space-y-2">
            <p className="font-semibold">O acesso ao sistema está bloqueado</p>
            <p>
              Seus dados no Google Drive <strong>não foram apagados</strong>. Para voltar a usar a
              agenda e os demais módulos, confirme o pagamento no Asaas.
            </p>
            {periodEnd && (
              <p className="text-amber-900/90">
                {sub.first_payment_at
                  ? `Período pago encerrou em ${formatDate(periodEnd)}.`
                  : `Período de teste encerrou em ${formatDate(periodEnd)}.`}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Plano</span>
            <span className="font-semibold text-gray-900">{profile.plan_name}</span>
          </div>
          {profile.plan_value != null && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-600">Mensalidade</span>
              <span>R$ {profile.plan_value.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {payError && (
            <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
              {payError}
            </p>
          )}
          <button
            type="button"
            onClick={openPagamentoAsaas}
            disabled={payLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-60"
          >
            {payLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ExternalLink className="h-5 w-5" />
            )}
            Abrir pagamento no Asaas
          </button>
          <p className="text-center text-xs text-gray-500 leading-relaxed">
            PIX, cartão ou boleto no site seguro do Asaas. Após confirmação, o acesso libera em
            poucos minutos.
          </p>
        </div>

        <div className="mt-8 space-y-2 border-t border-gray-200 pt-6">
          <Link
            href="/backup"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Exportar backup dos dados
          </Link>
          <Link
            href="/dashboard/conta"
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <CreditCard className="h-4 w-4" />
            Ver detalhes da conta
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-gray-500 hover:text-gray-800"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          {CANONICAL_APP_URL.replace('https://', '')}
        </p>
      </div>
    </div>
  );
}
