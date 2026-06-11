'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Cloud,
  HardDrive,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import LandingBrandAnimation from '@/components/LandingBrandAnimation';
import { formatCurrency, LANDING_PLANOS } from '@/lib/constants';
import { BRAND } from '@/lib/visual/brand';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { DEFAULT_LIST_PRICE, PRICE_LOCK_MONTHS } from '@/lib/subscriptionPricing';

const { colors: CORES, productName: PRODUCT_NAME } = BRAND;
const P = CORES.primary;
const S = CORES.primaryHover;
const A = CORES.accent;
const BG = CORES.primaryBg;
const ON_DARK = CORES.heroTextOnDark;
const ON_DARK_MUTED = CORES.heroTextMutedOnDark;

const googleIntegrations = [
  {
    title: 'Google Calendar',
    desc: 'Sessões sincronizadas com a agenda que você já usa. Menos conflito de horário, mais previsibilidade.',
    Icon: Calendar,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Google Drive',
    desc: 'Fichas e documentos do cliente ficam na sua pasta Drive — mesmo se você cancelar a assinatura, nunca perde o acesso aos registros dos seus clientes.',
    Icon: HardDrive,
    color: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Google Contatos',
    desc: 'Importe telefones para lembretes e formulários sem redigitar cadastros manualmente.',
    Icon: Users,
    color: 'bg-[var(--brand-bg-onboarding)] text-[var(--brand-primary)]',
  },
];

const privacidadePontos = [
  'Arquivos e documentos de clientes permanecem no Google Drive da sua conta',
  'O Turquesa Agenda não abre, não copia e não revende dados dos seus clientes',
  'Metadados operacionais mínimos (agenda, fila de mensagens) com base legal e transparência',
  'Login com Google: você controla permissões e pode revogar acesso quando quiser',
  'Arquitetura pensada para LGPD desde o desenho do produto',
];

const recursos = [
  {
    title: 'Agenda unificada',
    desc: 'Visual claro da semana, integração Calendar e lembretes por WhatsApp.',
    Icon: Calendar,
  },
  {
    title: 'Financeiro Profissional',
    desc: 'Controle de entradas e saídas, repasse por profissional, gráficos na Visão gráfica e exportação CSV/PNG.',
    Icon: Wallet,
    highlight: true,
  },
  {
    title: 'Lembretes WhatsApp',
    desc: 'Lembretes por WhatsApp (wa.me) e link para o cliente agendar online.',
    Icon: MessageCircle,
  },
];

export default function LandingPageContent() {
  const [listPrice, setListPrice] = useState(DEFAULT_LIST_PRICE);

  useEffect(() => {
    fetch('/api/pricing/list-price')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.list_price === 'number') setListPrice(data.list_price);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="bg-white">
      <section
        className="landing-hero relative overflow-hidden"
        style={{ backgroundColor: P }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, ${S} 0%, transparent 45%), radial-gradient(circle at 80% 0%, #3795a1 0%, transparent 40%)`,
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28 text-center">
          <LandingBrandAnimation />
          <p className="landing-hero-muted mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Privacidade primeiro · LGPD by design
          </p>
          <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Liberdade para crescer.
            <br />
            <span style={{ color: ON_DARK_MUTED }}>Controle total dos seus dados.</span>
          </h1>
          <p className="landing-hero-muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed md:text-xl">
            A única agenda para salões com profissionais ilimitados por R$ 79,90 fixos. Gestão
            financeira com split e dados no seu Google Drive.
          </p>
          <div className="relative z-10 mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="relative z-10 inline-flex touch-manipulation items-center justify-center gap-2 rounded-2xl bg-white py-4 px-10 text-lg font-semibold shadow-lg shadow-black/20 transition hover:bg-[var(--brand-bg-onboarding)]"
              style={{ color: P }}
            >
              Começar com Google — 30 dias grátis
            </Link>
            <Link
              href="/planos"
              className="relative z-10 inline-flex touch-manipulation items-center justify-center rounded-2xl border-2 border-white/90 py-4 px-10 text-lg font-semibold transition hover:bg-white/15"
              style={{ color: ON_DARK }}
            >
              Ver preço
            </Link>
          </div>
          <p className="landing-hero-muted mt-8 text-sm opacity-95">
            Sem cartão · Cancele quando quiser · Suporte por e-mail
          </p>
        </div>
      </section>

      <section className="bg-gradient-to-b px-6 py-20 md:py-28" style={{ backgroundImage: `linear-gradient(to bottom, ${BG}, white)` }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: P }}
            >
              <ShieldCheck className="h-4 w-4" />
              Nosso diferencial
            </span>
            <h2 className="mt-6 text-3xl font-bold leading-tight text-gray-900 md:text-4xl">
              Nós não ficamos com os dados do seu salão
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Muitos sistemas centralizam arquivos na nuvem do fornecedor. O {PRODUCT_NAME} foi
              desenhado ao contrário: você mantém a custódia; nós entregamos ferramentas conectadas
              ao ecossistema Google que você já confia.
            </p>
          </div>

          <div className="mt-14 grid items-center gap-10 md:grid-cols-2">
            <div
              className="rounded-3xl border-2 bg-white p-8 shadow-xl md:p-10"
              style={{ borderColor: `${S}66` }}
            >
              <div
                className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: P }}
              >
                <Cloud className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">O que fica com você</h3>
              <ul className="mt-6 space-y-4">
                {privacidadePontos.map((item) => (
                  <li key={item} className="flex gap-3 text-gray-700">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: S }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="landing-hero relative overflow-hidden rounded-3xl p-8 md:p-10"
              style={{ backgroundColor: P }}
            >
              <div
                className="absolute -right-8 -top-8 h-40 w-40 rounded-full blur-2xl"
                style={{ backgroundColor: `${A}44` }}
              />
              <p className="landing-accent-on-dark text-sm font-semibold uppercase tracking-wider">
                Em uma frase
              </p>
              <p className="mt-4 text-2xl font-bold leading-snug md:text-3xl">
                &ldquo;Seus clientes, seus arquivos, sua conta Google — nosso software só
                orquestra.&rdquo;
              </p>
              <p className="landing-hero-muted mt-6 text-sm leading-relaxed">
                Ideal para salões solo ou com equipe que levam a sério privacidade, LGPD e
                independência de fornecedor.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Integração nativa com Google
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Use as ferramentas que você já conhece. Com o Drive, seus registros de clientes
              permanecem na sua conta Google — mesmo após cancelar o {PRODUCT_NAME}.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {googleIntegrations.map(({ title, desc, Icon, color }) => (
              <article
                key={title}
                className="group rounded-3xl border border-gray-100 bg-gray-50/80 p-8 transition duration-300 hover:shadow-lg"
                style={{ borderColor: undefined }}
              >
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="mt-3 leading-relaxed text-gray-600">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Tudo para o dia a dia do salão
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {recursos.map(({ title, desc, Icon, highlight }) => (
              <div
                key={title}
                className={`rounded-2xl border bg-white p-6 text-center${highlight ? ' border-2' : ' border-gray-100'}`}
                style={highlight ? { borderColor: P, backgroundColor: BG } : undefined}
              >
                <Icon className="mx-auto mb-4 h-8 w-8" style={{ color: highlight ? P : S }} />
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-24 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-lg">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Plano único e transparente</h2>
            <p className="mt-4 text-lg text-gray-600">
              30 dias grátis · Assinatura única · Garantia de {PRICE_LOCK_MONTHS} meses
              sem reajuste
            </p>
          </div>
          {LANDING_PLANOS.map((plano) => (
            <article
              key={plano.nome}
              className="relative flex flex-col rounded-3xl border-2 p-8 shadow-lg transition hover:shadow-xl"
              style={{ borderColor: P, backgroundColor: BG }}
            >
              <h3 className="text-xl font-bold text-gray-900">{plano.nome}</h3>
              <p className="mt-1 text-sm text-gray-500">{plano.medicos}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold" style={{ color: P }}>
                  {formatCurrency(listPrice)}
                </span>
                <span className="text-gray-500">{plano.periodo}</span>
              </div>
              <p className="mt-4 flex-1 text-sm text-gray-600">{plano.descricao}</p>
              <p className="mt-2 text-xs text-gray-500">
                Preço garantido por {PRICE_LOCK_MONTHS} meses a partir do cadastro. Reajustes de
                tabela valem apenas para novos clientes durante o período de garantia dos atuais.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-700">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0" style={{ color: S }} />
                  Google Calendar, Drive e Contatos
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0" style={{ color: S }} />
                  Dados no seu Drive
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0" style={{ color: S }} />
                  LGPD e suporte por e-mail
                </li>
              </ul>
              <Link
                href="/login"
                className="mt-8 block rounded-2xl py-3.5 text-center font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: P }}
              >
                Testar 30 dias grátis
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta-dark py-20" style={{ backgroundColor: P }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Pronto para um salão mais leve?</h2>
          <p className="landing-hero-muted mt-4 text-lg leading-relaxed">
            Entre com sua conta Google em minutos. Sem migração forçada para nossa nuvem — você
            decide o que compartilha.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-2xl bg-white px-10 py-4 text-lg font-semibold shadow-lg transition hover:bg-[var(--brand-bg-onboarding)]"
            style={{ color: P }}
          >
            Criar conta com Google
          </Link>
          <p className="landing-hero-muted mt-8 text-xs opacity-95">
            <a href="/privacidade" className="underline hover:opacity-100" style={{ color: ON_DARK }}>
              Privacidade
            </a>
            {' · '}
            <a href="/termos" className="underline hover:opacity-100" style={{ color: ON_DARK }}>
              Termos de Uso
            </a>
          </p>
          <div className="mt-8 border-t border-white/20 pt-8">
            <p className="landing-hero-muted text-sm">Dúvidas comerciais ou parcerias</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="landing-accent-on-dark mt-2 inline-flex items-center gap-2 text-lg font-semibold transition hover:opacity-90"
            >
              <Mail className="h-5 w-5" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
