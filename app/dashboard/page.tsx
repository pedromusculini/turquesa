'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  DollarSign,
  Users,
  Clock,
  ArrowRight,
  Stethoscope,
  Building2,
  CalendarDays,
  Wallet,
  HardDrive,
  ChevronRight,
  User,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import AutocadastroLinkCard from '@/components/AutocadastroLinkCard';
import GoogleIntegracaoCard from '@/components/GoogleIntegracaoCard';
import LembretesWhatsAppCard from '@/components/LembretesWhatsAppCard';
import DashboardAgendaHoje from '@/components/DashboardAgendaHoje';
import { getDashboardStats, loadConsultations } from '@/lib/consultations';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: CalendarDays },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/backup', label: 'Backup', icon: HardDrive },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: MessageCircle },
  { href: '/dashboard/perfil', label: 'Meu Perfil', icon: User },
];

function DashboardPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    consultasHoje: 0,
    pendentesHoje: 0,
    faturamentoMes: 0,
    pacientesAtendidos: 0,
    proximosAgendamentos: 0,
  });

  const handleStatsChange = useCallback(
    (s: ReturnType<typeof getDashboardStats>) => setStats(s),
    [],
  );

  useEffect(() => {
    setMounted(true);
    setStats(getDashboardStats(loadConsultations()));
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (!mounted || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#228B22] mx-auto mb-4" />
          <p className="text-gray-500">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) return null;

  const role = (session.user as { role?: string })?.role || 'medico';
  const roleLabel = role === 'medico' ? 'Médico' : 'Clínica';
  const roleIcon = role === 'medico' ? Stethoscope : Building2;
  const RoleIcon = roleIcon;

  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-[73px] left-0 z-50 h-[calc(100vh-73px)]
          w-64 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}
          lg:translate-x-0 lg:pointer-events-auto
        `}
      >
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#90EE90] rounded-full flex items-center justify-center text-[#228B22]">
              <RoleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{session.user?.name}</p>
              <p className="text-xs text-gray-500">{roleLabel}</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === '/dashboard';
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-[#90EE90]/20 text-[#228B22]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <Link
            href="/onboarding"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
            Configurar perfil
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="btn-action p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            aria-label="Abrir menu"
          >
            <CalendarDays className="w-5 h-5" />
          </button>
        </div>

        <h1 className="hidden lg:block text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="hidden lg:block text-gray-500 mb-8">
          Bem-vindo de volta, {session.user?.name?.split(' ')[0]}!
        </p>

        <GoogleIntegracaoCard />

        <AutocadastroLinkCard />

        <div className="mb-6">
          <LembretesWhatsAppCard />
        </div>

        <Link
          href="/clientes?finalizar=1"
          className="flex items-center gap-4 mb-6 p-5 rounded-2xl bg-[#013a01] text-white shadow-sm hover:bg-[#025201] transition-colors group"
        >
          <div className="p-3 bg-white/15 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base">Atendimento avulso</p>
            <p className="text-sm text-green-100/90 font-normal">Lançar atendimento</p>
          </div>
          <ArrowRight className="w-5 h-5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.consultasHoje}</span>
            </div>
            <p className="text-sm text-gray-500">
              Consultas hoje
              {stats.pendentesHoje > 0 && (
                <span className="text-amber-600"> · {stats.pendentesHoje} pendentes</span>
              )}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-green-50 rounded-xl">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.faturamentoMes)}
              </span>
            </div>
            <p className="text-sm text-gray-500">Faturamento do mês</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-50 rounded-xl">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.pacientesAtendidos}</span>
            </div>
            <p className="text-sm text-gray-500">Pacientes atendidos no mês</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.proximosAgendamentos}</span>
            </div>
            <p className="text-sm text-gray-500">Aguardando atendimento hoje</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <DashboardAgendaHoje onStatsChange={handleStatsChange} />

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Acesso rápido</h2>
            <div className="space-y-3">
              <Link
                href="/clientes?finalizar=1"
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-[#013a01] bg-[#fafffa] hover:bg-green-50 transition-all group"
              >
                <div className="p-2.5 bg-[#013a01] rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">Atendimento avulso</p>
                  <p className="text-xs text-gray-500">Lançar atendimento</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#228B22] transition-colors" />
              </Link>

              <Link
                href="/agenda"
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#90EE90] hover:bg-[#fafffa] transition-all group"
              >
                <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">Agenda</p>
                  <p className="text-xs text-gray-400">Agendar e gerenciar</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#228B22] transition-colors" />
              </Link>

              <Link
                href="/clientes"
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#90EE90] hover:bg-[#fafffa] transition-all group"
              >
                <div className="p-2.5 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">Clientes</p>
                  <p className="text-xs text-gray-400">Cadastro e histórico</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#228B22] transition-colors" />
              </Link>

              <Link
                href="/financeiro"
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#90EE90] hover:bg-[#fafffa] transition-all group"
              >
                <div className="p-2.5 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                  <Wallet className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">Financeiro</p>
                  <p className="text-xs text-gray-400">Receitas e relatórios</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#228B22] transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#228B22]" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
