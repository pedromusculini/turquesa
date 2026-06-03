'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { BRAND, DEFAULT_PLAN_ID, formatCurrency, PLANOS } from '@/lib/constants';

const { colors: C, productName, copy } = BRAND;
const plano = PLANOS.ilimitado;

function ChoosePlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  useEffect(() => {
    if (searchParams.get('legacy') === '1') return;
    router.replace(`/login?plan=${DEFAULT_PLAN_ID}${email ? `&email=${encodeURIComponent(email)}` : ''}`);
  }, [router, searchParams, email]);

  if (searchParams.get('legacy') !== '1') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: C.bgPage }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: C.primaryHover }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: C.bgPage }}
    >
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{productName}</h1>
          <p className="text-gray-500 mt-2">Plano único — solo ou equipe</p>
        </div>

        <article
          className="rounded-2xl border-2 p-6"
          style={{ borderColor: C.primary, backgroundColor: C.primaryBg }}
        >
          <p className="text-xl font-bold text-gray-900">{plano.nome}</p>
          <p className="mt-2 text-3xl font-bold" style={{ color: C.primary }}>
            {formatCurrency(plano.valor)}
            <span className="text-base font-normal text-gray-500">{plano.periodo}</span>
          </p>
          <p className="mt-3 text-sm text-gray-600">{plano.descricao}</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            {['Profissionais ilimitados', `${copy.trialDays} dias grátis`, 'PIX via Asaas'].map(
              (item) => (
                <li key={item} className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0" style={{ color: C.primaryHover }} />
                  {item}
                </li>
              ),
            )}
          </ul>
        </article>

        <Link
          href={`/login?plan=${DEFAULT_PLAN_ID}`}
          className="mt-8 block rounded-2xl py-3.5 text-center font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: C.primaryHover }}
        >
          Entrar com Google
        </Link>
      </div>
    </div>
  );
}

export default function ChoosePlanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <ChoosePlanContent />
    </Suspense>
  );
}
