'use client';

/**
 * Landing de conversão Meta (mobile-first).
 *
 * MESSAGE MATCH: alinhar H1 ao anúncio Meta vencedor.
 * Pack atual (Variante A):
 *   H1: Pare de perder cliente e horário no WhatsApp
 *   Sub: Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão.
 *   CTA: Começar meu trial grátis
 * Trocar H1 para match literal do criativo que performar melhor no Ads Manager.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Mail } from 'lucide-react';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import {
  LandingAgendaMock,
  LandingClientesMock,
  LandingFinanceiroMock,
} from '@/components/LandingProductMock';
import { formatCurrency } from '@/lib/constants';
import { BRAND } from '@/lib/visual/brand';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { trackMetaLead } from '@/lib/metaPixel';
import { DEFAULT_LIST_PRICE, PRICE_LOCK_MONTHS } from '@/lib/subscriptionPricing';

const { colors: C, productName } = BRAND;
const P = C.primary;
const S = C.primaryHover;
const A = C.accent;
const BG = C.bgPage;

/** CTA → login Google → (OTP se preciso) → onboarding. */
const CTA_HREF = '/login?callbackUrl=%2Fonboarding';
const CTA_LABEL = 'Começar meu trial grátis';

const benefits = [
  {
    title: 'Agenda no Google, da dona à equipe',
    desc: 'Cada profissional na própria Calendar — menos desencontro de horário.',
  },
  {
    title: 'Cliente lembrado no WhatsApp',
    desc: 'Templates + wa.me: você envia o lembrete, sem robô.',
  },
  {
    title: 'Dinheiro e repasse sem planilha',
    desc: 'Veja entradas e comissão no mesmo sistema da agenda.',
  },
];

const faqs = [
  {
    q: 'Preciso de cartão no trial?',
    a: 'Não. 30 dias grátis sem cartão. Você só assina se fizer sentido.',
  },
  {
    q: 'O WhatsApp é automático (robô)?',
    a: 'Não. São templates e links wa.me — você revisa e envia. Semi-manual, sem disparo em massa.',
  },
  {
    q: 'Serve para uma profissional só?',
    a: 'Sim. Solo ou equipe no mesmo plano — profissionais sem limite artificial.',
  },
  {
    q: 'Preciso usar Google?',
    a: 'Login e agenda forte usam Google Calendar/Drive/Contatos. É o jeito de manter arquivos e horários sob o seu controle.',
  },
  {
    q: 'Posso cancelar?',
    a: 'Sim, quando quiser. Arquivos no seu Google Drive continuam na sua conta.',
  },
  {
    q: 'Onde ficam meus dados?',
    a: 'Fichas e documentos no seu Drive; eventos na Calendar conectada. O Turquesa orquestra — não fica com a custódia dos arquivos.',
  },
  {
    q: 'O que inclui o plano?',
    a: 'Agenda, clientes, financeiro/repasse, WhatsApp (wa.me), catálogo, agendamento online e Google — no Turquesa Agenda Ilimitado.',
  },
];

function PrimaryCta({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <Link
      href={CTA_HREF}
      onClick={() => trackMetaLead(source)}
      className={
        className ??
        'inline-flex min-h-14 w-full touch-manipulation items-center justify-center rounded-2xl px-6 text-base font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99]'
      }
      style={{ backgroundColor: P }}
    >
      {CTA_LABEL}
    </Link>
  );
}

export default function LandingPageContent() {
  const [listPrice, setListPrice] = useState(DEFAULT_LIST_PRICE);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetch('/api/pricing/list-price')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.list_price === 'number') setListPrice(data.list_price);
      })
      .catch(() => undefined);
  }, []);

  const priceLabel = formatCurrency(listPrice);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <style jsx>{`
        @keyframes lpIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .lp-in {
          animation: lpIn 0.55s ease-out both;
        }
        .lp-in-delay {
          animation: lpIn 0.55s ease-out 0.12s both;
        }
      `}</style>

      {/* Header mínimo — sem nav de site */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#F8FAFC]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4 sm:max-w-5xl sm:px-6">
          <div className="flex items-center gap-2">
            <BrandLogoIcon size={28} priority />
            <span className="text-sm font-semibold tracking-tight" style={{ color: P }}>
              {productName}
            </span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* HERO — mobile above-the-fold: H1 + CTA + prova + pedaço do produto */}
      <section className="lp-in mx-auto max-w-lg px-4 pb-8 pt-6 sm:max-w-5xl sm:px-6 sm:pb-16 sm:pt-10">
        <div className="sm:grid sm:grid-cols-2 sm:items-start sm:gap-12 lg:gap-16">
          <div>
            <h1 className="text-[1.65rem] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl sm:leading-[1.12]">
              Pare de perder cliente e horário no WhatsApp
            </h1>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">
              Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão.
            </p>

            <div className="mt-5 sm:mt-7">
              <PrimaryCta source="landing_hero" />
            </div>
            <p className="mt-2.5 text-center text-[11px] leading-snug text-slate-500 sm:text-left sm:text-xs">
              Sem cartão · 30 dias grátis · {priceLabel}/mês depois · Cancele quando quiser
            </p>
            <p className="mt-1 text-center text-[11px] font-medium text-slate-600 sm:text-left sm:text-xs">
              Entrar com Google · leva cerca de 1 minuto
            </p>

            {/* Prova colada no CTA (honesta — sem números inventados) */}
            <p
              className="mt-4 rounded-xl border px-3 py-2.5 text-center text-[11px] font-medium leading-snug sm:text-left sm:text-xs"
              style={{ borderColor: `${S}55`, backgroundColor: '#eef4f5', color: P }}
            >
              Plano único · profissionais sem limite artificial · Google Calendar da dona e da
              equipe
            </p>
          </div>

          <div className="lp-in-delay mt-6 sm:mt-0">
            <LandingAgendaMock compact />
          </div>
        </div>
      </section>

      {/* 3 benefícios */}
      <section className="border-t border-slate-200/80 bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-lg gap-6 sm:max-w-5xl sm:grid-cols-3 sm:gap-8">
          {benefits.map((b) => (
            <div key={b.title}>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">{b.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problema → solução */}
      <section className="px-4 py-12 sm:px-6 sm:py-16" style={{ backgroundColor: BG }}>
        <div className="mx-auto max-w-lg sm:max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            WhatsApp não é agenda de salão
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Mensagem some, profissional não sabe o horário, cliente falta, dinheiro fica na
            planilha. O {productName} junta agenda (Google), clientes, lembretes wa.me e financeiro
            num só lugar — para você trabalhar melhor e perder menos tempo.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              'Horário combinado no zap e esquecido na grade',
              'Equipe sem Calendar sincronizada',
              'Repasse e caixa no escuro',
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-slate-700">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: A }}
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 blocos produto */}
      <section className="bg-white px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-lg flex-col gap-12 sm:max-w-5xl sm:gap-16">
          <div className="sm:grid sm:grid-cols-2 sm:items-center sm:gap-10">
            <div>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Agenda que a equipe e o Google respeitam
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Sessões na grade do salão e na Calendar de cada profissional. Menos conflito, mais
                previsibilidade.
              </p>
            </div>
            <LandingAgendaMock />
          </div>

          <div className="sm:grid sm:grid-cols-2 sm:items-center sm:gap-10">
            <div className="sm:order-2">
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Cliente na ficha, lembrete no WhatsApp
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Histórico do atendimento e mensagem pronta com link wa.me — você envia, no seu
                ritmo. Sem robô.
              </p>
            </div>
            <div className="mt-6 sm:order-1 sm:mt-0">
              <LandingClientesMock />
            </div>
          </div>

          <div className="sm:grid sm:grid-cols-2 sm:items-center sm:gap-10">
            <div>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Financeiro e repasse sem planilha
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Entradas do dia e parte da equipe no mesmo lugar da agenda — sem recontar no Excel.
              </p>
            </div>
            <LandingFinanceiroMock />
          </div>
        </div>
      </section>

      {/* Preço */}
      <section id="preco" className="scroll-mt-16 px-4 py-12 sm:px-6 sm:py-20" style={{ backgroundColor: BG }}>
        <div className="mx-auto max-w-lg">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Um plano. Preço claro.
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            30 dias grátis · depois {priceLabel}/mês
          </p>

          <article
            className="mt-8 rounded-3xl border-2 bg-white p-6 shadow-sm sm:p-8"
            style={{ borderColor: P }}
          >
            <h3 className="text-lg font-bold text-slate-900">Turquesa Agenda Ilimitado</h3>
            <p className="mt-1 text-sm text-slate-500">Profissionais sem limite artificial</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold" style={{ color: P }}>
                {priceLabel}
              </span>
              <span className="text-slate-500">/mês</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Agenda, clientes, financeiro, WhatsApp (wa.me), catálogo e Google. Preço garantido{' '}
              {PRICE_LOCK_MONTHS} meses a partir do cadastro.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {[
                '30 dias grátis, sem cartão',
                'Google Calendar, Drive e Contatos',
                'Cancele quando quiser',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: S }} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <PrimaryCta source="landing_pricing" />
            </div>
          </article>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-lg sm:max-w-2xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">Perguntas frequentes</h2>
          <div className="mt-8 space-y-2">
            {faqs.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div key={item.q} className="rounded-2xl border border-slate-200 bg-[#F8FAFC]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-slate-900"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : idx)}
                  >
                    {item.q}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`}
                      style={{ color: S }}
                      aria-hidden
                    />
                  </button>
                  {open && (
                    <p className="border-t border-slate-200/80 px-4 py-3 text-sm leading-relaxed text-slate-600">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 py-14 sm:px-6 sm:py-20" style={{ backgroundColor: P }}>
        <div className="mx-auto max-w-lg text-center sm:max-w-xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Pare de perder cliente e horário no WhatsApp
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#D9F0F2] sm:text-base">
            Comece seu trial grátis. Agenda, Google e financeiro — feitos para o salão.
          </p>
          <div className="mt-6">
            <Link
              href={CTA_HREF}
              onClick={() => trackMetaLead('landing_final')}
              className="inline-flex min-h-14 w-full touch-manipulation items-center justify-center rounded-2xl bg-white px-6 text-base font-bold shadow-md transition hover:bg-[#eef4f5] active:scale-[0.99] sm:w-auto sm:min-w-[280px]"
              style={{ color: P }}
            >
              {CTA_LABEL}
            </Link>
          </div>
          <p className="mt-3 text-xs text-[#D9F0F2]">
            Sem cartão · 30 dias grátis · {priceLabel}/mês depois
          </p>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center text-xs text-slate-500 sm:max-w-5xl sm:flex-row sm:justify-between sm:text-left">
          <p>
            <a href="/privacidade" className="underline hover:text-slate-800">
              Privacidade
            </a>
            {' · '}
            <a href="/termos" className="underline hover:text-slate-800">
              Termos
            </a>
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-1.5 font-medium hover:text-slate-800"
            style={{ color: P }}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}
