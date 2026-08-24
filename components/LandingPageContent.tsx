'use client';

/**
 * Landing de conversão Meta (mobile-first).
 *
 * MESSAGE MATCH: alinhar H1 ao anúncio Meta vencedor.
 * Pack atual (Variante C — dor WhatsApp):
 *   H1: Pare de perder cliente e horário no WhatsApp
 *   Sub: Autoagenda + WhatsApp incluso + cai na agenda Google. 30 dias sem cartão.
 *   CTA único: Começar meu trial com Google
 *   Micro-funil: Google → onboarding → primeira sessão
 * Trocar H1 para match literal do criativo que performar melhor no Ads Manager.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Mail } from 'lucide-react';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import HeroWordmarkInline from '@/components/HeroWordmarkInline';
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
const HERO_MUTED = C.heroTextMutedOnDark;

/** CTA → login Google → onboarding → primeira sessão. */
const CTA_HREF = '/login?callbackUrl=%2Fonboarding';
const CTA_LABEL = 'Começar meu trial com Google';

const funnelSteps = [
  {
    n: '1',
    title: 'Entre com Google',
    desc: 'Login rápido. Agenda, Drive e Contatos na sua conta — sem app a mais no bolso.',
  },
  {
    n: '2',
    title: 'Configure o salão',
    desc: 'Nome, serviços e WhatsApp em poucos minutos. O trial de 30 dias começa aí — sem cartão.',
  },
  {
    n: '3',
    title: 'Compartilhe o link',
    desc: 'A cliente marca e se cadastra sozinha. O horário cai na agenda Google da profissional.',
  },
];

const trustSignals = [
  {
    title: 'Sai do caos do WhatsApp',
    desc: 'Autoagendamento + mensagens prontas e lembretes. Sem marketplace, sem taxa por mensagem.',
  },
  {
    title: 'WhatsApp incluso no plano',
    desc: 'Templates e lembretes nativos — você envia pelo WhatsApp, sem custo extra de integração.',
  },
  {
    title: 'Cai na agenda Google',
    desc: 'Horário e cadastro vão para a Calendar da profissional (e a cliente vê o compromisso). Sem app paralelo.',
  },
];

const benefits = [
  {
    title: 'Cliente marca sozinha',
    desc: 'Link de autoagendamento: ela vê o horário vago, marca e se cadastra — sem “tem horário?” no zap.',
  },
  {
    title: 'WhatsApp nativo, sem taxa extra',
    desc: 'Confirmação, lembrete e mensagens prontas no plano. Sem pagar pacote à parte de WhatsApp.',
  },
  {
    title: 'Direto na agenda Google',
    desc: 'Agendamento e ficha no fluxo da Calendar — profissional e cliente no Google, sem outro aplicativo.',
  },
];

const faqs = [
  {
    q: 'Preciso de cartão no trial?',
    a: 'Não. 30 dias grátis sem cartão. Você só assina se fizer sentido.',
  },
  {
    q: 'O login é só com Google?',
    a: 'Sim. Entrar com Google já confirma o e-mail e libera o onboarding — sem código extra.',
  },
  {
    q: 'O WhatsApp é robô / API automática?',
    a: 'Não. São templates e lembretes nativos do Turquesa: você revisa e envia pelo WhatsApp (wa.me). Incluso no plano — sem taxa extra de integração e sem disparo em massa.',
  },
  {
    q: 'A cliente precisa baixar outro app?',
    a: 'Não. Ela marca pelo link, se cadastra e o horário entra na agenda Google. Sem marketplace e sem app obrigatório.',
  },
  {
    q: 'Serve para uma profissional só?',
    a: 'Sim. Solo ou equipe — cadastre a equipe toda no mesmo plano.',
  },
  {
    q: 'Preciso usar Google?',
    a: 'Sim. Login e agenda usam Google Calendar, Drive e Contatos — para horários e fichas ficarem sob o seu controle, sem outro app.',
  },
  {
    q: 'Posso cancelar?',
    a: 'Sim, quando quiser. Arquivos no seu Google Drive continuam na sua conta.',
  },
  {
    q: 'O que inclui o plano?',
    a: 'Autoagendamento, autocadastro, WhatsApp (templates e lembretes), agenda Google, clientes, financeiro/repasse e catálogo — no Turquesa Agenda Ilimitado, sem custo extra de WhatsApp.',
  },
];

function GoogleGIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GoogleCta({
  source,
  variant = 'light',
}: {
  source: string;
  variant?: 'light' | 'solid';
}) {
  const isLight = variant === 'light';
  return (
    <Link
      href={CTA_HREF}
      onClick={() => trackMetaLead(source)}
      className={
        isLight
          ? 'inline-flex min-h-14 w-full touch-manipulation items-center justify-center gap-2.5 rounded-xl border border-white/40 bg-white px-5 text-base font-bold tracking-tight shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_12px_40px_rgba(0,0,0,0.28)] transition hover:bg-[#eef4f5] hover:shadow-[0_0_24px_rgba(55,149,161,0.45)] active:scale-[0.99] sm:min-h-16 sm:gap-3 sm:rounded-2xl sm:px-8 sm:text-lg'
          : 'inline-flex min-h-14 w-full touch-manipulation items-center justify-center gap-2.5 rounded-2xl px-6 text-base font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99]'
      }
      style={isLight ? { color: P } : { backgroundColor: P }}
    >
      <GoogleGIcon className="shrink-0 sm:h-[22px] sm:w-[22px]" />
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
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .lp-in {
          animation: lpIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .lp-in-delay {
          animation: lpIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.14s both;
        }
        .lp-in-cta {
          animation: lpIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both;
        }
        .lp-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 20%, transparent 75%);
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-in,
          .lp-in-delay,
          .lp-in-cta {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      {/* Zona teal: header + hero full-bleed */}
      <div
        className="landing-hero relative overflow-hidden"
        style={{
          background: `linear-gradient(155deg, ${S} 0%, ${P} 28%, ${C.primaryDark} 68%, #023840 100%)`,
        }}
      >
        <div className="lp-grid pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -right-16 top-0 h-[28rem] w-[28rem] rounded-full opacity-35 blur-3xl sm:-right-8 sm:h-[36rem] sm:w-[36rem]"
          style={{ backgroundColor: S }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ backgroundColor: A }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-px w-[min(90%,42rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          aria-hidden
        />

        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#047482]/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4 sm:h-16 sm:max-w-6xl sm:px-8 lg:max-w-7xl">
            <div className="flex items-center gap-2.5">
              <BrandLogoIcon size={30} priority />
              <span className="text-sm font-semibold tracking-tight text-white sm:text-base">
                {productName}
              </span>
            </div>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
            >
              Entrar
            </Link>
          </div>
        </header>

        <section className="lp-in relative mx-auto max-w-lg px-4 pb-14 pt-10 sm:max-w-6xl sm:px-8 sm:pb-24 sm:pt-16 lg:max-w-7xl lg:pb-28 lg:pt-20">
          <div className="sm:grid sm:grid-cols-[1.05fr_0.95fr] sm:items-center sm:gap-14 lg:gap-20 xl:gap-24">
            <div className="sm:pr-2 lg:pr-6">
              <div className="mb-6 flex justify-center sm:mb-8 sm:justify-start">
                <HeroWordmarkInline className="drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)] !max-h-[4.75rem] sm:!max-h-28 lg:!max-h-32" />
              </div>

              <div className="flex justify-center sm:justify-start">
                <p
                  className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] sm:text-[0.7rem]"
                  style={{ backgroundColor: `${A}e6`, color: '#1a1208' }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#047482] shadow-[0_0_8px_rgba(4,116,130,0.8)]"
                    aria-hidden
                  />
                  30 dias grátis · sem cartão
                </p>
              </div>

              <h1 className="mt-5 text-center text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] text-white sm:mt-6 sm:text-left sm:text-5xl sm:leading-[1.05] lg:text-[3.25rem]">
                Pare de perder cliente e horário no WhatsApp
              </h1>
              <p
                className="mt-4 text-center text-base leading-relaxed sm:mt-5 sm:max-w-xl sm:text-left sm:text-xl sm:leading-relaxed"
                style={{ color: HERO_MUTED }}
              >
                Autoagenda + WhatsApp incluso + horário na agenda Google. 30 dias sem cartão — veja
                o dia a dia ficar mais organizado.
              </p>

              <div className="lp-in-cta mt-7 sm:mt-10 sm:max-w-md">
                <GoogleCta source="landing_hero" variant="light" />
              </div>
              <p
                className="mt-3 text-center text-xs leading-snug tracking-wide sm:text-left sm:text-sm"
                style={{ color: HERO_MUTED }}
              >
                Sem cartão · {priceLabel}/mês depois · Cancele quando quiser
              </p>
              <p
                className="mt-4 text-center text-[0.8rem] font-medium leading-relaxed tracking-wide sm:text-left sm:text-sm"
                style={{ color: C.accentOnDark }}
              >
                Google → onboarding → primeira sessão na agenda
              </p>
            </div>

            <div className="lp-in-delay mt-10 sm:mt-0">
              <div className="relative origin-center sm:scale-105 lg:origin-right lg:scale-110">
                <div
                  className="pointer-events-none absolute -inset-4 rounded-[1.75rem] opacity-50 blur-2xl sm:-inset-6"
                  style={{ backgroundColor: S }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -inset-px rounded-2xl opacity-60"
                  style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.35), transparent 40%, ${A}66)`,
                  }}
                  aria-hidden
                />
                <div className="relative overflow-hidden rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.4)] ring-1 ring-white/25">
                  <LandingAgendaMock compact />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Como começar */}
      <section className="border-t border-slate-200/80 bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-lg sm:max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Como começar em 3 passos
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-600 sm:text-base">
            Nada de surpresa no meio do caminho. Você sabe exatamente o que vem depois do clique.
          </p>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
            {funnelSteps.map((step) => (
              <li key={step.n} className="relative">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: P }}
                  aria-hidden
                >
                  {step.n}
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 sm:text-lg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Confiança / posicionamento (sem depoimentos inventados) */}
      <section className="px-4 py-12 sm:px-6 sm:py-16" style={{ backgroundColor: BG }}>
        <div className="mx-auto max-w-lg sm:max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Feito para quem vive no WhatsApp — e quer sair do caos
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-600 sm:text-base">
            Não somos marketplace. Autoagenda, WhatsApp incluso e Google nativos — sem taxa extra
            de integração.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
            {trustSignals.map((item) => (
              <div key={item.title}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${P}14` }}
                    aria-hidden
                  >
                    <Check className="h-3.5 w-3.5" style={{ color: P }} />
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problema → solução */}
      <section className="bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-lg sm:max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            WhatsApp não é agenda de salão
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            “Tem horário?”, vácuo, remarcação no chat, cliente que falta. O {productName} tira o
            agendamento do zap: a cliente marca e se cadastra sozinha, o horário cai na agenda
            Google da profissional — e o WhatsApp entra com mensagens e lembretes prontos, incluso
            no plano, sem custo extra.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              'Vácuo no WhatsApp e cliente que marca em outro lugar',
              'Horário “combinado” que não entra na agenda da profissional',
              'Lembrete esquecido — e cadeira vazia no dia',
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

      {/* 3 benefícios */}
      <section className="px-4 py-12 sm:px-6 sm:py-16" style={{ backgroundColor: BG }}>
        <div className="mx-auto grid max-w-lg gap-6 sm:max-w-5xl sm:grid-cols-3 sm:gap-8">
          {benefits.map((b) => (
            <div key={b.title}>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">{b.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 blocos produto */}
      <section className="bg-white px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-lg flex-col gap-12 sm:max-w-5xl sm:gap-16">
          <div className="sm:grid sm:grid-cols-2 sm:items-center sm:gap-10">
            <div>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Autoagenda: marca e cai no Google
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                A cliente escolhe o horário vago e se cadastra. O agendamento vai direto para a
                agenda Google da profissional — sem avisar no zap, sem outro aplicativo.
              </p>
            </div>
            <LandingAgendaMock />
          </div>

          <div className="sm:grid sm:grid-cols-2 sm:items-center sm:gap-10">
            <div className="sm:order-2">
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                WhatsApp incluso — sem taxa extra
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Confirmação, lembrete (30, 7, 5 ou 1 dia) e mensagens prontas no plano. Você revisa
                e envia pelo WhatsApp. Nativo do Turquesa — sem pacote à parte.
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
            <p className="mt-1 text-sm text-slate-500">Cadastre a equipe toda no mesmo plano</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold" style={{ color: P }}>
                {priceLabel}
              </span>
              <span className="text-slate-500">/mês</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Autoagenda, WhatsApp incluso, agenda Google, clientes, financeiro e catálogo. Preço
              garantido {PRICE_LOCK_MONTHS} meses a partir do cadastro.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {[
                '30 dias grátis, sem cartão',
                'WhatsApp e Google nativos — sem taxa extra',
                'Cancele quando quiser',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: S }} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <GoogleCta source="landing_pricing" variant="solid" />
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Google → onboarding → primeira sessão
            </p>
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
            Use 30 dias sem cartão e veja o dia a dia mais organizado: autoagenda, WhatsApp incluso
            e horário na agenda Google.
          </p>
          <div className="mt-6 sm:mx-auto sm:max-w-sm">
            <GoogleCta source="landing_final" variant="light" />
          </div>
          <p className="mt-3 text-xs text-[#D9F0F2]">
            Sem cartão · 30 dias grátis · {priceLabel}/mês depois
          </p>
          <p className="mt-2 text-xs font-medium text-[#F2E0C8]">
            Google → onboarding → primeira sessão na agenda
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
