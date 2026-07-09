'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import { BRAND } from '@/lib/visual/brand';
import {
  Calendar,
  Users,
  ArrowRight,
  CalendarDays,
  BookOpen,
  Wallet,
  HardDrive,
  ChevronRight,
  User,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import AddToHomeScreenCard from '@/components/AddToHomeScreenCard';
import AutocadastroLinkCard from '@/components/AutocadastroLinkCard';
import InstallAppLinkCard from '@/components/InstallAppLinkCard';
import GoogleIntegracaoCard from '@/components/GoogleIntegracaoCard';
import GoogleConnectionAlert from '@/components/GoogleConnectionAlert';
import LembretesWhatsAppCard from '@/components/LembretesWhatsAppCard';
import DashboardAgendaHoje from '@/components/DashboardAgendaHoje';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';
import GuiaFuncionalidadesCard from '@/components/GuiaFuncionalidadesCard';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: CalendarDays },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/catalogo', label: 'Catálogo', icon: BookOpen },
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

  useEffect(() => {
    setMounted(true);
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#047482] mx-auto mb-4" />
          <p className="text-gray-500">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) return null;

  const roleLabel = 'Turquesa Agenda';

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
        <div className="p-4 border-b border-gray-100">
          <Link
            href="/dashboard"
            className="mb-4 flex items-center gap-2.5 rounded-lg transition hover:opacity-80"
          >
            <BrandLogoIcon size={28} className="h-7 w-auto" />
            <span className="font-semibold text-sm text-gray-900">{BRAND.productName}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <User className="h-5 w-5 text-gray-600" />
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
                    ? 'bg-[#3795a1]/20 text-[#047482]'
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
        <p className="hidden lg:block text-gray-500 mb-6">
          Bem-vindo de volta, {session.user?.name?.split(' ')[0]}!
        </p>

        <GuiaFuncionalidadesCard />

        <Link
          href="/clientes?finalizar=1"
          data-tour="atendimento-avulso"
          className="flex items-center gap-4 mb-6 p-5 rounded-2xl bg-[#047482] text-white shadow-sm hover:bg-[#035e6b] transition-colors group"
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

        <div className="mb-6" data-tour="lembretes-whatsapp">
          <PrimeirosPassosHint
            hintId="hint-comunicacao-lembretes"
            title="Lembretes"
            message="Ajuste os prazos em Configurações e envie lembretes de sessão aqui, com um toque no WhatsApp."
            className="mb-3"
          />
          <LembretesWhatsAppCard />
        </div>

        <div className="mb-6" data-tour="dashboard-overview">
          <PrimeirosPassosHint
            hintId="hint-dashboard-stats"
            title="Resumo do dia"
            message="Acompanhe a agenda de hoje e finalize sessões direto do painel."
          />
        </div>

        <div className="mb-8">
          <DashboardAgendaHoje userEmail={session.user?.email ?? ''} />
        </div>

        <section className="mb-8" data-tour="dashboard-links">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Links</h2>
          <GoogleConnectionAlert redirectPath="/dashboard" className="mb-4" />
          <GoogleIntegracaoCard />
          <InstallAppLinkCard />
          <AutocadastroLinkCard />
          <AddToHomeScreenCard />
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#047482]" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
