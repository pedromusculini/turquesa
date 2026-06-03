'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { CORES, formatCurrency, LANDING_PLANOS, PRODUCT_NAME } from '@/lib/constants';
import { SUPPORT_EMAIL } from '@/lib/legal';

const PLAN_FEATURES = [
  'Google Calendar, Drive e Contatos',
  'Profissionais ilimitados (solo ou equipe)',
  'Agenda, financeiro e lembretes WhatsApp',
  'Dados no seu Google Drive · LGPD',
] as const;

export default function PlanosPage() {
  const plano = LANDING_PLANOS[0];

  return (
    <div className="bg-gray-50">
      <section className="text-white" style={{ backgroundColor: CORES.primary }}>
        <div className="mx-auto max-w-5xl px-6 py-14 text-center">
          <h1 className="text-3xl font-bold md:text-4xl">Plano {PRODUCT_NAME}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-teal-100">
            30 dias grátis. Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-lg px-6 py-14">
        <article
          className="relative flex flex-col rounded-3xl border-2 bg-white p-8 shadow-lg"
          style={{ borderColor: CORES.primary, backgroundColor: CORES.primaryBg }}
        >
          <h2 className="text-xl font-bold text-gray-900">{plano.nome}</h2>
          <p className="mt-1 text-sm text-gray-500">{plano.medicos}</p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold" style={{ color: CORES.primary }}>
              {formatCurrency(plano.valor)}
            </span>
            <span className="text-gray-500">{plano.periodo}</span>
          </div>
          <p className="mt-4 flex-1 text-sm text-gray-600">{plano.descricao}</p>
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="h-4 w-4 shrink-0" style={{ color: CORES.primaryHover }} />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href="/login?plan=ilimitado"
            className="mt-8 block rounded-2xl py-3.5 text-center font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: CORES.primary }}
          >
            Começar 30 dias grátis
          </Link>
        </article>

        <p className="mt-10 text-center text-sm text-gray-600">
          Pagamento via PIX (integração Asaas). Dúvidas:{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium hover:underline"
            style={{ color: CORES.primaryHover }}
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </section>

      <section className="border-t border-gray-200 bg-white py-14">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
            Perguntas frequentes
          </h2>
          <div className="space-y-6 text-gray-600">
            <div>
              <h3 className="font-semibold text-gray-900">
                Preciso de cartão de crédito para o trial?
              </h3>
              <p className="mt-2">Não. Você testa 30 dias sem informar pagamento.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                O {PRODUCT_NAME} guarda os arquivos dos meus clientes?
              </h3>
              <p className="mt-2">
                Não. Documentos ficam no seu Google Drive; o app organiza agenda e operação sem
                acessar o conteúdo que você guarda na nuvem, em linha com a LGPD.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">O que acontece após o trial?</h3>
              <p className="mt-2">
                Você ativa o plano e paga via PIX. Pode cancelar antes do fim dos 30 dias sem custo.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
