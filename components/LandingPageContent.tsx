import Link from 'next/link';
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
import { CORES, formatCurrency, LANDING_PLANOS, PRODUCT_NAME } from '@/lib/constants';
import { SUPPORT_EMAIL } from '@/lib/legal';

const P = CORES.primary;
const S = CORES.primaryHover;
const A = CORES.accent;
const BG = CORES.primaryBg;

const googleIntegrations = [
  {
    title: 'Google Calendar',
    desc: 'Sessões sincronizadas com a agenda que você já usa. Menos conflito de horário, mais previsibilidade.',
    Icon: Calendar,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Google Drive',
    desc: 'Fichas e documentos do cliente ficam na sua pasta Drive — o Turquesa Agenda organiza o acesso, não armazena o conteúdo.',
    Icon: HardDrive,
    color: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Google Contatos',
    desc: 'Importe telefones para lembretes e formulários sem redigitar cadastros manualmente.',
    Icon: Users,
    color: 'bg-teal-50 text-teal-700',
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
    title: 'Financeiro do salão',
    desc: 'Entradas, saídas e visão do fluxo sem planilhas paralelas.',
    Icon: Wallet,
  },
  {
    title: 'Lembretes WhatsApp',
    desc: 'Lembretes por WhatsApp (wa.me) e link para o cliente agendar online.',
    Icon: MessageCircle,
  },
];

export default function LandingPageContent() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: P }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, ${S} 0%, transparent 45%), radial-gradient(circle at 80% 0%, #40E0D0 0%, transparent 40%)`,
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28 text-center">
          <LandingBrandAnimation />
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium text-teal-100">
            <Sparkles className="h-4 w-4" />
            Privacidade primeiro · LGPD by design
          </p>
          <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Gestão para salões e estúdios
            <br />
            <span style={{ color: '#40E0D0' }}>sem tomar posse dos seus dados</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-teal-50/95 md:text-xl">
            O {PRODUCT_NAME} organiza agenda, clientes e rotina operacional — mas{' '}
            <strong className="text-white">não acessa</strong> o conteúdo que você guarda no{' '}
            <strong className="text-white">seu Google Drive</strong>, em conformidade com a LGPD.
          </p>
          <div className="relative z-10 mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="relative z-10 inline-flex touch-manipulation items-center justify-center gap-2 rounded-2xl bg-white py-4 px-10 text-lg font-semibold shadow-lg shadow-black/20 transition hover:bg-teal-50"
              style={{ color: P }}
            >
              Começar com Google — 30 dias grátis
            </Link>
            <Link
              href="/planos"
              className="relative z-10 inline-flex touch-manipulation items-center justify-center rounded-2xl border-2 border-white/80 py-4 px-10 text-lg font-semibold text-white transition hover:bg-white/10"
            >
              Ver preço
            </Link>
          </div>
          <p className="mt-8 text-sm text-teal-200/90">
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
              className="relative overflow-hidden rounded-3xl p-8 text-white md:p-10"
              style={{ backgroundColor: P }}
            >
              <div
                className="absolute -right-8 -top-8 h-40 w-40 rounded-full blur-2xl"
                style={{ backgroundColor: `${A}44` }}
              />
              <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: A }}>
                Em uma frase
              </p>
              <p className="mt-4 text-2xl font-bold leading-snug md:text-3xl">
                &ldquo;Seus clientes, seus arquivos, sua conta Google — nosso software só
                orquestra.&rdquo;
              </p>
              <p className="mt-6 text-sm leading-relaxed text-teal-100/90">
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
              Use as ferramentas que você já conhece. O {PRODUCT_NAME} conecta permissões de forma
              explícita — sem surpresas.
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
            {recursos.map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-100 bg-white p-6 text-center"
              >
                <Icon className="mx-auto mb-4 h-8 w-8" style={{ color: S }} />
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
              30 dias grátis · Um preço para solo e equipe
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
                  {formatCurrency(plano.valor)}
                </span>
                <span className="text-gray-500">{plano.periodo}</span>
              </div>
              <p className="mt-4 flex-1 text-sm text-gray-600">{plano.descricao}</p>
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

      <section className="py-20 text-white" style={{ backgroundColor: P }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Pronto para um salão mais leve?</h2>
          <p className="mt-4 text-lg leading-relaxed text-teal-100">
            Entre com sua conta Google em minutos. Sem migração forçada para nossa nuvem — você
            decide o que compartilha.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-2xl bg-white px-10 py-4 text-lg font-semibold shadow-lg transition hover:bg-teal-50"
            style={{ color: P }}
          >
            Criar conta com Google
          </Link>
          <p className="mt-8 text-xs text-teal-200/90">
            <a href="/privacidade" className="underline hover:text-white">
              Privacidade
            </a>
            {' · '}
            <a href="/termos" className="underline hover:text-white">
              Termos de Uso
            </a>
          </p>
          <div className="mt-8 border-t border-white/20 pt-8">
            <p className="text-sm text-teal-100">Dúvidas comerciais ou parcerias</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-2 inline-flex items-center gap-2 text-lg font-semibold transition hover:text-white"
              style={{ color: A }}
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
