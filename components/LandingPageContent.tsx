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
import { formatCurrency, LANDING_PLANOS } from '@/lib/constants';

const googleIntegrations = [
  {
    title: 'Google Calendar',
    desc: 'Consultas sincronizadas com a agenda que você já usa. Menos conflito de horário, mais previsibilidade.',
    Icon: Calendar,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Google Drive',
    desc: 'Prontuários e documentos do paciente ficam na sua pasta Drive — o MedSupAPP organiza o acesso, não armazena o conteúdo clínico.',
    Icon: HardDrive,
    color: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Google Contatos',
    desc: 'Importe telefones para lembretes e formulários sem redigitar cadastros manualmente.',
    Icon: Users,
    color: 'bg-green-50 text-[#228B22]',
  },
];

const privacidadePontos = [
  'Dados clínicos e arquivos de pacientes permanecem no Google Drive da sua conta',
  'O MedSupAPP não abre, não copia e não revende prontuários ou documentos médicos',
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
    title: 'Financeiro do consultório',
    desc: 'Entradas, saídas e visão do fluxo sem planilhas paralelas.',
    Icon: Wallet,
  },
  {
    title: 'Lembretes WhatsApp',
    desc: 'Lembretes por WhatsApp (wa.me) e link para o paciente agendar online.',
    Icon: MessageCircle,
  },
];

export default function LandingPageContent() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#013a01] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #90EE90 0%, transparent 45%), radial-gradient(circle at 80% 0%, #228B22 0%, transparent 40%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28 text-center">
          <LandingBrandAnimation />
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium text-green-100 mb-6">
            <Sparkles className="w-4 h-4" />
            Privacidade primeiro · LGPD by design
          </p>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            Gestão para consultórios
            <br />
            <span className="text-[#90EE90]">sem tomar posse dos seus dados</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-green-100/95 leading-relaxed">
            O diferencial MedSupAPP: organizamos agenda, clientes e rotina operacional —
            mas <strong className="text-white">não acessamos</strong> o conteúdo clínico do médico
            ou da clínica. Seus prontuários ficam no <strong className="text-white">seu Google Drive</strong>,
            em conformidade com a LGPD.
          </p>
          <div className="relative z-10 mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="relative z-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-[#013a01] font-semibold py-4 px-10 text-lg shadow-lg shadow-black/20 hover:bg-green-50 transition touch-manipulation"
            >
              Começar com Google — 30 dias grátis
            </Link>
            <Link
              href="/planos"
              className="relative z-10 inline-flex items-center justify-center rounded-2xl border-2 border-white/80 text-white font-semibold py-4 px-10 text-lg hover:bg-white/10 transition touch-manipulation"
            >
              Ver preços
            </Link>
          </div>
          <p className="mt-8 text-sm text-green-200/90">
            Sem cartão · Cancele quando quiser · Suporte por e-mail
          </p>
        </div>
      </section>

      {/* Diferencial LGPD */}
      <section className="px-6 py-20 md:py-28 bg-gradient-to-b from-[#f4fff4] to-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#013a01] text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5">
              <ShieldCheck className="w-4 h-4" />
              Nosso diferencial
            </span>
            <h2 className="mt-6 text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              Nós não ficamos com os dados do seu consultório
            </h2>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              Muitos sistemas centralizam prontuários na nuvem do fornecedor. O MedSupAPP foi
              desenhado ao contrário: você mantém a custódia; nós entregamos ferramentas de gestão
              conectadas ao ecossistema Google que você já confia.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-2 gap-10 items-center">
            <div className="rounded-3xl border-2 border-[#90EE90]/50 bg-white p-8 md:p-10 shadow-xl shadow-green-900/5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#013a01] text-white mb-6">
                <Cloud className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">O que fica com você</h3>
              <ul className="mt-6 space-y-4">
                {privacidadePontos.map((item) => (
                  <li key={item} className="flex gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-[#228B22] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-3xl bg-[#013a01] text-white p-8 md:p-10 overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-[#90EE90]/20 blur-2xl" />
              <p className="text-sm font-semibold uppercase tracking-wider text-[#90EE90]">
                Em uma frase
              </p>
              <p className="mt-4 text-2xl md:text-3xl font-bold leading-snug">
                &ldquo;Seus pacientes, seus arquivos, sua conta Google — nosso software só
                orquestra.&rdquo;
              </p>
              <p className="mt-6 text-green-100/90 text-sm leading-relaxed">
                Ideal para médicos e clínicas que levam a sério sigilo profissional, auditoria
                LGPD e independência de fornecedor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Google */}
      <section className="px-6 py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Integração nativa com Google
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Use as ferramentas que você já conhece. O MedSupAPP conecta permissões de forma
              explícita — sem surpresas.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {googleIntegrations.map(({ title, desc, Icon, color }) => (
              <article
                key={title}
                className="group rounded-3xl border border-gray-100 bg-gray-50/80 p-8 hover:border-[#90EE90] hover:shadow-lg hover:shadow-green-900/5 transition duration-300"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color} mb-5`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="mt-3 text-gray-600 leading-relaxed">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Tudo para o dia a dia do consultório
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {recursos.map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="rounded-2xl bg-white border border-gray-100 p-6 text-center"
              >
                <Icon className="w-8 h-8 text-[#228B22] mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="px-6 py-20 md:py-28 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Planos transparentes</h2>
            <p className="mt-4 text-lg text-gray-600">
              30 dias grátis em qualquer plano · Pagamento via PIX (em breve integração Asaas)
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {LANDING_PLANOS.map((plano) => (
              <article
                key={plano.nome}
                className={`relative flex flex-col rounded-3xl border-2 p-8 transition hover:shadow-xl ${
                  plano.destaque
                    ? 'border-[#013a01] bg-[#f4fff4] shadow-lg scale-[1.02]'
                    : 'border-gray-100 bg-white shadow-md'
                }`}
              >
                {plano.destaque && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#013a01] text-white text-xs font-bold px-4 py-1">
                    Mais escolhido
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plano.nome}</h3>
                <p className="text-sm text-gray-500 mt-1">{plano.medicos}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#013a01]">
                    {formatCurrency(plano.valor)}
                  </span>
                  <span className="text-gray-500">{plano.periodo}</span>
                </div>
                <p className="mt-4 text-gray-600 text-sm flex-1">{plano.descricao}</p>
                <ul className="mt-6 space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 text-[#228B22] shrink-0" />
                    Google Calendar, Drive e Contatos
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 text-[#228B22] shrink-0" />
                    Dados clínicos no seu Drive
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 text-[#228B22] shrink-0" />
                    LGPD e suporte por e-mail
                  </li>
                </ul>
                <Link
                  href="/login"
                  className={`mt-8 block text-center rounded-2xl py-3.5 font-semibold transition ${
                    plano.destaque
                      ? 'bg-[#013a01] text-white hover:bg-[#025201]'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Testar 30 dias grátis
                </Link>
              </article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/planos"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-[#013a01] px-8 py-3.5 font-semibold text-[#013a01] transition hover:bg-[#f4fff4]"
            >
              Ver comparativo completo dos planos
            </Link>
          </div>
        </div>
      </section>

      {/* CTA + contato comercial */}
      <section className="bg-[#013a01] py-20 text-white">
        <div className="mx-auto max-w-3xl text-center px-6">
          <h2 className="text-3xl md:text-4xl font-bold">Pronto para um consultório mais leve?</h2>
          <p className="mt-4 text-lg text-green-100 leading-relaxed">
            Entre com sua conta Google em minutos. Sem migração forçada de prontuários para nossa
            nuvem — você decide o que compartilha.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block bg-white text-[#013a01] font-semibold px-10 py-4 rounded-2xl text-lg hover:bg-green-50 transition shadow-lg"
          >
            Criar conta com Google
          </Link>
          <p className="mt-8 text-xs text-green-200/90">
            <a href="/privacidade" className="hover:text-white underline">
              Privacidade
            </a>
            {' · '}
            <a href="/termos" className="hover:text-white underline">
              Termos de Uso
            </a>
          </p>
          <div className="mt-8 pt-8 border-t border-white/20">
            <p className="text-green-100 text-sm">Dúvidas comerciais ou parcerias</p>
            <a
              href="mailto:contato@medsupapp.com.br"
              className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-[#90EE90] hover:text-white transition"
            >
              <Mail className="w-5 h-5" />
              contato@medsupapp.com.br
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
