'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatCurrency, LANDING_PLANOS } from '@/lib/constants';

const PLAN_IDS = ['medico-pix', 'clinica-5-pix', 'clinica-10-pix'] as const;

const PLAN_FEATURES = [
  [
    'Google Calendar, Drive e Contatos',
    'Dados clínicos no seu Google Drive',
    'Agenda e lembretes WhatsApp',
    'LGPD e suporte por e-mail',
  ],
  [
    'Google Calendar, Drive e Contatos',
    'Até 5 médicos na mesma clínica',
    'Financeiro e relatórios da equipe',
    'LGPD e suporte por e-mail',
  ],
  [
    'Google Calendar, Drive e Contatos',
    'Até 10 médicos na mesma clínica',
    'Escala com controle e privacidade',
    'LGPD e suporte por e-mail',
  ],
] as const;

export default function PlanosPage() {
  return (
    <div className="bg-gray-50">
      <section className="bg-[#013a01] text-white">
        <div className="mx-auto max-w-5xl px-6 py-14 text-center">
          <h1 className="text-3xl font-bold md:text-4xl">Escolha o plano ideal</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-green-100">
            30 dias grátis em qualquer plano. Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-8 md:grid-cols-3">
          {LANDING_PLANOS.map((plano, index) => (
            <article
              key={PLAN_IDS[index]}
              className={`relative flex flex-col rounded-3xl border-2 bg-white p-8 shadow-md transition hover:shadow-xl ${
                plano.destaque ? 'border-[#013a01] bg-[#f4fff4] shadow-lg' : 'border-gray-100'
              }`}
            >
              {plano.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#013a01] px-4 py-1 text-xs font-bold text-white">
                  Mais escolhido
                </span>
              )}
              <h2 className="text-xl font-bold text-gray-900">{plano.nome}</h2>
              <p className="mt-1 text-sm text-gray-500">{plano.medicos}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#013a01]">
                  {formatCurrency(plano.valor)}
                </span>
                <span className="text-gray-500">{plano.periodo}</span>
              </div>
              <p className="mt-4 flex-1 text-sm text-gray-600">{plano.descricao}</p>
              <ul className="mt-6 space-y-2 text-sm text-gray-700">
                {PLAN_FEATURES[index].map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-[#228B22]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={`/login?plan=${PLAN_IDS[index]}`}
                className={`mt-8 block rounded-2xl py-3.5 text-center font-semibold transition ${
                  plano.destaque
                    ? 'bg-[#013a01] text-white hover:bg-[#025201]'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                Começar 30 dias grátis
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-600">
          Pagamento via PIX (integração Asaas em breve). Dúvidas:{' '}
          <a
            href="mailto:contato@medsupapp.com.br"
            className="font-medium text-[#228B22] hover:underline"
          >
            contato@medsupapp.com.br
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
              <p className="mt-2">
                Não. Você testa 30 dias sem informar pagamento.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                O MedSupAPP guarda meus prontuários?
              </h3>
              <p className="mt-2">
                Não. Documentos e dados clínicos ficam no seu Google Drive; o app organiza
                agenda e operação sem acessar o conteúdo clínico, em linha com a LGPD.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">O que acontece após o trial?</h3>
              <p className="mt-2">
                Você escolhe o plano e paga via PIX. Pode cancelar antes do fim dos 30 dias sem
                custo.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
