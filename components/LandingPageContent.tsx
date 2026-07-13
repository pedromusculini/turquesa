'use client';

/**
 * Landing de conversão — hero Variante A (pain killer).
 *
 * A/B futuros (não exibir juntos):
 * B — Headline: "Sua agenda do salão no Google — da dona à equipe."
 *     Sub: "Cada profissional na própria Calendar. Clientes, lembretes no WhatsApp e financeiro no mesmo sistema. Completo, simples e por R$ 79,90/mês."
 *     CTA: "Testar grátis por 30 dias"
 * C — Headline: "O salão organizado que seus clientes percebem."
 *     Sub: "Menos falta, menos confusão na equipe, mais controle do dinheiro — com agenda ligada ao Google. Um plano só: R$ 79,90/mês, 30 dias grátis."
 *     CTA: "Quero organizar meu salão"
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  Mail,
  MessageCircle,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import LandingBrandAnimation from '@/components/LandingBrandAnimation';
import LandingHeroAgendaPreview from '@/components/LandingHeroAgendaPreview';
import { formatCurrency, LANDING_PLANOS } from '@/lib/constants';
import { BRAND } from '@/lib/visual/brand';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { trackMetaLead } from '@/lib/metaPixel';
import { DEFAULT_LIST_PRICE, PRICE_LOCK_MONTHS } from '@/lib/subscriptionPricing';

const { colors: CORES, productName: PRODUCT_NAME } = BRAND;
const P = CORES.primary;
const S = CORES.primaryHover;
const A = CORES.accent;
const BG = CORES.primaryBg;
const ON_DARK = CORES.heroTextOnDark;
const ON_DARK_MUTED = CORES.heroTextMutedOnDark;

const CTA_HREF = '/login?callbackUrl=%2Fonboarding';
const CTA_LABEL = 'Começar 30 dias grátis';

const pains = [
  'Agenda no WhatsApp que some e gera desencontro',
  'Profissional sem horário certo — cliente espera ou falta',
  'Dinheiro e repasse na planilha (ou na cabeça)',
  'Vários apps e nenhuma visão do salão inteiro',
];

const valueBlocks = [
  {
    title: 'Agenda que a equipe e o Google respeitam',
    benefit:
      'Cada profissional na própria Calendar. Menos conflito de horário, mais previsibilidade no dia a dia.',
    proof: 'Sync com Google Calendar da dona e da equipe.',
    Icon: Calendar,
  },
  {
    title: 'Cliente lembrado, sem robô de WhatsApp',
    benefit:
      'Histórico na ficha e lembretes com templates + link wa.me — você envia com um toque, no seu ritmo.',
    proof: 'Comunicação semi-manual: controle seu, mensagem pronta.',
    Icon: MessageCircle,
  },
  {
    title: 'Financeiro e repasse sem planilha',
    benefit:
      'Veja entradas, comissão por profissional e o que sobra para o salão — sem recontar no Excel.',
    proof: 'Repasse e visão do caixa no mesmo sistema da agenda.',
    Icon: Wallet,
  },
  {
    title: 'Tudo num só lugar — completo e barato',
    benefit:
      'Agenda, clientes, catálogo, financeiro e Google. Um plano único, sem tiers confusos.',
    proof: 'Feito para salão solo ou com equipe.',
    Icon: Users,
  },
];

const steps = [
  {
    n: '1',
    title: 'Crie sua conta',
    desc: 'Entre com Google e configure o salão em minutos.',
  },
  {
    n: '2',
    title: 'Conecte Google e equipe',
    desc: 'Calendar da dona e das profissionais — cada uma na sua agenda.',
  },
  {
    n: '3',
    title: 'Agende, lembre e controle',
    desc: 'Sessões, clientes, WhatsApp e financeiro no mesmo fluxo.',
  },
];

const trustPoints = [
  '30 dias para testar de verdade',
  'Preço único e transparente',
  'Agenda ligada ao Google Calendar',
  'Cancele quando quiser',
  'Interface e suporte em português',
];

const faqs = [
  {
    q: 'Preciso de cartão no trial?',
    a: 'Não. Você testa 30 dias sem cartão. Só assina se fizer sentido para o seu salão.',
  },
  {
    q: 'Funciona só com Google?',
    a: 'O login e as integrações fortes (Calendar, Drive, Contatos) usam Google — é o jeito mais simples de manter sua agenda e arquivos sob o seu controle.',
  },
  {
    q: 'Serve para uma profissional só?',
    a: 'Sim. Funciona para solo e para equipe. O plano é o mesmo: profissionais sem limite artificial.',
  },
  {
    q: 'E se a equipe não quiser baixar app?',
    a: 'Cada profissional pode usar a própria Google Calendar. O Turquesa orquestra; elas não precisam instalar outro app se não quiserem.',
  },
  {
    q: 'O WhatsApp é automático (robô)?',
    a: 'Não. São templates e links wa.me — você revisa e envia. Semi-manual, sem API Meta de disparo em massa.',
  },
  {
    q: 'Posso cancelar?',
    a: 'Sim. Cancele quando quiser. Seus arquivos no Google Drive continuam na sua conta.',
  },
  {
    q: 'Meus dados e a agenda ficam onde?',
    a: 'Fichas e documentos no seu Google Drive; eventos na Calendar conectada. O Turquesa orquestra — não fica com a custódia dos arquivos do cliente.',
  },
  {
    q: 'O que está incluso no plano único?',
    a: 'Agenda, clientes, catálogo, financeiro/repasse, comunicação WhatsApp (wa.me), agendamento online e integrações Google — tudo no Turquesa Agenda Ilimitado.',
  },
];

function PrimaryCta({
  source,
  className,
  dark,
}: {
  source: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={CTA_HREF}
      onClick={() => trackMetaLead(source)}
      className={
        className ??
        (dark
          ? 'inline-flex min-h-14 w-full max-w-md touch-manipulation items-center justify-center rounded-2xl bg-white px-8 py-4 text-base font-semibold shadow-lg transition hover:bg-(--brand-bg-onboarding) sm:w-auto sm:text-lg'
          : 'inline-flex min-h-14 w-full max-w-md touch-manipulation items-center justify-center rounded-2xl px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-95 sm:w-auto sm:text-lg')
      }
      style={dark ? { color: P } : { backgroundColor: P }}
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
  const dailyApprox = formatCurrency(Math.round((listPrice / 30) * 100) / 100);

  return (
    <div className="bg-white">
      {/* 1. Hero — Variante A */}
      <section
        className="landing-hero relative overflow-hidden"
        style={{ backgroundColor: P }}
      >
        <style jsx>{`
          @keyframes landingFadeUp {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .landing-hero-copy {
            animation: landingFadeUp 0.7s ease-out 0.15s both;
          }
          .landing-hero-visual {
            animation: landingFadeUp 0.8s ease-out 0.35s both;
          }
        `}</style>
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 18% 15%, ${S} 0%, transparent 42%), radial-gradient(circle at 88% 8%, ${A}55 0%, transparent 38%), linear-gradient(160deg, transparent 40%, ${CORES.primaryDark}55 100%)`,
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pt-14 md:pt-20">
          <LandingBrandAnimation />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-2 md:pb-24 md:pt-4">
          <div className="grid gap-12 md:grid-cols-2 md:items-center md:gap-14 lg:gap-16">
            <div className="landing-hero-copy text-center md:text-left">
              <h1 className="text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem]">
                Pare de perder cliente e horário no WhatsApp.
              </h1>
              <p className="landing-hero-muted mx-auto mt-5 max-w-xl text-base leading-relaxed md:mx-0 md:text-lg">
                Agenda, equipe, Google Calendar, clientes e financeiro num só lugar — feito para
                salão solo ou com equipe. Comece grátis por 30 dias.
              </p>

              <div className="relative z-10 mt-8 flex flex-col items-center gap-3 md:items-start">
                <PrimaryCta source="landing_hero" dark />
                <a
                  href="#como-funciona"
                  className="text-sm font-medium underline decoration-white/40 underline-offset-4 transition hover:decoration-white"
                  style={{ color: ON_DARK_MUTED }}
                >
                  Ver como funciona
                </a>
              </div>

              <p className="landing-hero-muted mt-6 text-sm leading-relaxed">
                Sem cartão no trial · {priceLabel}/mês depois · Cancele quando quiser
              </p>
            </div>

            <div className="landing-hero-visual mx-auto w-full max-w-md md:max-w-none">
              <LandingHeroAgendaPreview />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Prova social honesta */}
      <section className="border-b border-slate-100 bg-white px-6 py-8">
        <p className="mx-auto max-w-4xl text-center text-sm font-medium tracking-wide text-slate-600 md:text-base">
          Para salões solo e com equipe · Agenda + Google + Financeiro · Plano único sem surpresa
        </p>
      </section>

      {/* 3. Dor → alívio */}
      <section
        className="px-6 py-20 md:py-28"
        style={{ backgroundImage: `linear-gradient(to bottom, ${BG}, white)` }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              O caos do dia a dia tem nome — e tem solução
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              O {PRODUCT_NAME} para o aperto do dia a dia — faltas, desencontro, planilha — e sobe o
              nível do salão: equipe alinhada, clientes lembrados e dinheiro com clareza.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Antes
              </p>
              <ul className="mt-4 space-y-3">
                {pains.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-700"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: A }}
                      aria-hidden
                    />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="landing-hero flex flex-col justify-center rounded-3xl p-8 md:p-10"
              style={{ backgroundColor: P }}
            >
              <p className="landing-accent-on-dark text-sm font-semibold uppercase tracking-wider">
                Com o Turquesa
              </p>
              <p className="mt-4 text-xl font-bold leading-snug md:text-2xl" style={{ color: ON_DARK }}>
                Um sistema só: agenda no Google, cliente na ficha, lembrete no WhatsApp e dinheiro
                com clareza — para você trabalhar melhor e perder menos tempo.
              </p>
              <div className="mt-8">
                <PrimaryCta source="landing_pain_relief" dark />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Blocos de valor */}
      <section className="bg-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Feito para ajudar o salão a rodar
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Não é “mais um app de horário”. É o painel do dia a dia — completo, claro e no preço
              certo.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2">
            {valueBlocks.map(({ title, benefit, proof, Icon }, i) => (
              <article
                key={title}
                className={`rounded-3xl border border-slate-100 bg-slate-50/60 p-8 ${
                  i % 2 === 1 ? 'sm:translate-y-4' : ''
                }`}
              >
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundColor: i === 3 ? A : P }}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                <p className="mt-3 leading-relaxed text-slate-600">{benefit}</p>
                <p className="mt-4 text-sm font-medium" style={{ color: S }}>
                  {proof}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Como funciona */}
      <section
        id="como-funciona"
        className="scroll-mt-24 px-6 py-20 md:py-28"
        style={{ backgroundColor: BG }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Como funciona</h2>
            <p className="mt-4 text-lg text-slate-600">
              Três passos. Sem migração forçada, sem curso de três semanas.
            </p>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <li
                key={step.n}
                className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center md:text-left"
              >
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ backgroundColor: P }}
                >
                  {step.n}
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-slate-600">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Confiança */}
      <section className="bg-white px-6 py-20 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: P }}
          >
            <ShieldCheck className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Comece sem risco — e no seu Google
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Teste com calma. Seus arquivos ficam na sua conta Google; o {PRODUCT_NAME} só orquestra
            agenda, clientes e financeiro.
          </p>
          <ul className="mx-auto mt-10 grid max-w-xl gap-3 text-left sm:grid-cols-1">
            {trustPoints.map((item) => (
              <li key={item} className="flex gap-3 text-slate-700">
                <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: S }} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Preço */}
      <section id="planos" className="scroll-mt-24 px-6 py-20 md:py-28" style={{ backgroundColor: BG }}>
        <div className="mx-auto max-w-lg">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Um plano. Preço claro.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              30 dias grátis · Depois {priceLabel}/mês · Menos de {dailyApprox}/dia
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Menos que o prejuízo de um horário vazio — e bem menos que juntar vários apps.
            </p>
          </div>

          {LANDING_PLANOS.map((plano) => (
            <article
              key={plano.nome}
              className="relative flex flex-col rounded-3xl border-2 bg-white p-8 shadow-lg"
              style={{ borderColor: P }}
            >
              <h3 className="text-xl font-bold text-slate-900">{plano.nome}</h3>
              <p className="mt-1 text-sm text-slate-500">{plano.medicos}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold" style={{ color: P }}>
                  {priceLabel}
                </span>
                <span className="text-slate-500">{plano.periodo}</span>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Agenda, clientes, financeiro, WhatsApp (wa.me), catálogo e Google — tudo incluso.
                Garantia de {PRICE_LOCK_MONTHS} meses sem reajuste a partir do cadastro.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                {[
                  'Google Calendar, Drive e Contatos',
                  'Profissionais sem limite artificial',
                  'Trial 30 dias sem cartão',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0" style={{ color: S }} aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <PrimaryCta
                  source="landing_planos"
                  className="inline-flex min-h-14 w-full touch-manipulation items-center justify-center rounded-2xl px-8 py-4 text-base font-semibold text-white transition hover:opacity-95"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="bg-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-3xl font-bold text-slate-900 md:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mt-12 space-y-3">
            {faqs.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-slate-900"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : idx)}
                  >
                    {item.q}
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 transition ${open ? 'rotate-180' : ''}`}
                      style={{ color: S }}
                      aria-hidden
                    />
                  </button>
                  {open && (
                    <p className="border-t border-slate-200/80 px-5 py-4 text-slate-600 leading-relaxed">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. CTA final */}
      <section className="landing-cta-dark py-20 md:py-24" style={{ backgroundColor: P }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold md:text-4xl" style={{ color: ON_DARK }}>
            Pare de perder cliente e horário no WhatsApp.
          </h2>
          <p className="landing-hero-muted mt-4 text-lg leading-relaxed">
            Comece grátis por 30 dias. Agenda, Google, clientes e financeiro — feitos para ajudar o
            seu salão.
          </p>
          <div className="mt-8 flex justify-center">
            <PrimaryCta source="landing_cta_final" dark />
          </div>
          <p className="landing-hero-muted mt-6 text-sm">
            Sem cartão no trial · {priceLabel}/mês depois · Cancele quando quiser
          </p>

          <p className="landing-hero-muted mt-10 text-xs opacity-95">
            <Link href="/funcionalidades" className="underline hover:opacity-100" style={{ color: ON_DARK }}>
              Funcionalidades
            </Link>
            {' · '}
            <a href="/privacidade" className="underline hover:opacity-100" style={{ color: ON_DARK }}>
              Privacidade
            </a>
            {' · '}
            <a href="/termos" className="underline hover:opacity-100" style={{ color: ON_DARK }}>
              Termos de Uso
            </a>
            {' · '}
            <Link href="/instalar" className="underline hover:opacity-100" style={{ color: ON_DARK }}>
              Instalar app
            </Link>
            {' · '}
            <Link href="/login" className="underline hover:opacity-100" style={{ color: ON_DARK }}>
              Entrar
            </Link>
          </p>
          <div className="mt-8 border-t border-white/20 pt-8">
            <p className="landing-hero-muted text-sm">Dúvidas</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="landing-accent-on-dark mt-2 inline-flex items-center gap-2 text-lg font-semibold transition hover:opacity-90"
            >
              <Mail className="h-5 w-5" aria-hidden />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
