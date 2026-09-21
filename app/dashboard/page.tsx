'use client';

import { useSession } from 'next-auth/react';
import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import { BRAND } from '@/lib/visual/brand';
import {
  Calendar,
  Users,
  CalendarDays,
  BookOpen,
  Wallet,
  HardDrive,
  BarChart3,
  User,
  MessageCircle,
  Globe,
} from 'lucide-react';
import AddToHomeScreenCard from '@/components/AddToHomeScreenCard';
import AutocadastroLinkCard from '@/components/AutocadastroLinkCard';
import PresencaSalaoCard from '@/components/PresencaSalaoCard';
import InstallAppLinkCard from '@/components/InstallAppLinkCard';
import GoogleIntegracaoCard from '@/components/GoogleIntegracaoCard';
import GoogleConnectionAlert from '@/components/GoogleConnectionAlert';
import LembretesWhatsAppCard from '@/components/LembretesWhatsAppCard';
import DashboardAgendaHoje from '@/components/DashboardAgendaHoje';
import DashboardQuickActions from '@/components/DashboardQuickActions';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';
import ComecePorAquiCard from '@/components/ComecePorAquiCard';
import GuiaFuncionalidadesCard from '@/components/GuiaFuncionalidadesCard';
import ClientesCrmDashboardCard from '@/components/ClientesCrmDashboardCard';
import ResgateWhatsAppCard from '@/components/ResgateWhatsAppCard';
import { useDeferredMount } from '@/lib/useDeferredMount';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: CalendarDays },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/clientes/relatorio', label: 'Relatório de clientes', icon: BarChart3 },
  { href: '/dashboard/catalogo', label: 'Catálogo', icon: BookOpen },
  { href: '/dashboard/configuracoes/presenca', label: 'Site do salão', icon: Globe },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/backup', label: 'Backup', icon: HardDrive },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: MessageCircle },
  { href: '/dashboard/perfil', label: 'Meu Perfil', icon: User },
];

function DashboardPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const heavyReady = useDeferredMount(1400);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' && !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-[#047482]" />
          <p className="text-gray-500">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) return null;

  const firstName = session.user?.name?.split(' ')[0] || 'olá';

  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
        <div className="border-b border-gray-100 p-4">
          <Link
            href="/dashboard"
            className="mb-4 flex items-center gap-2.5 rounded-lg transition hover:opacity-80"
          >
            <BrandLogoIcon size={28} className="h-7 w-auto" />
            <span className="text-sm font-semibold text-gray-900">{BRAND.productName}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <User className="h-5 w-5 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900">{session.user?.name}</p>
              <p className="text-xs text-gray-500">Turquesa Agenda</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === '/dashboard';
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#3795a1]/20 text-[#047482]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-4 lg:max-w-6xl lg:p-8">
        <div className="mb-4 lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#047482]">Hoje</p>
          <h1 className="text-xl font-bold text-gray-900">Olá, {firstName}</h1>
        </div>

        <h1 className="mb-2 hidden text-3xl font-bold text-gray-900 lg:block">Dashboard</h1>
        <p className="mb-6 hidden text-gray-500 lg:block">Bem-vindo de volta, {firstName}!</p>

        <ComecePorAquiCard />

        <DashboardQuickActions />

        <section className="mb-5" data-tour="dashboard-overview">
          <div className="hidden md:block">
            <PrimeirosPassosHint
              hintId="hint-dashboard-stats"
              title="Resumo do dia"
              message="Acompanhe a agenda de hoje e finalize sessões direto do painel."
            />
          </div>
          <DashboardAgendaHoje userEmail={session.user?.email ?? ''} />
        </section>

        <div className="mb-5" data-tour="lembretes-whatsapp">
          <div className="hidden md:block">
            <PrimeirosPassosHint
              hintId="hint-comunicacao-lembretes"
              title="Lembretes"
              message="Ajuste os prazos em Configurações e envie lembretes de sessão aqui, com um toque no WhatsApp."
            />
          </div>
          {heavyReady ? (
            <LembretesWhatsAppCard />
          ) : (
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          )}
        </div>

        <section className="mb-5" data-tour="dashboard-links">
          <h2 className="mb-3 text-base font-bold text-gray-900 lg:text-xl">Links</h2>
          <GoogleConnectionAlert redirectPath="/dashboard" className="mb-3" />
          <AutocadastroLinkCard />
          <PresencaSalaoCard />
        </section>

        <GoogleIntegracaoCard />

        <div className="lg:hidden">
          <details className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              Relatório, resgate e guia
            </summary>
            <div className="space-y-3 border-t border-gray-50 px-3 pb-3 pt-3">
              <GuiaFuncionalidadesCard />
              {heavyReady ? (
                <ClientesCrmDashboardCard />
              ) : (
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              )}
              <div data-tour="resgate-clientes">
                {heavyReady ? (
                  <ResgateWhatsAppCard />
                ) : (
                  <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                )}
              </div>
            </div>
          </details>
        </div>

        <div className="hidden lg:block">
          <GuiaFuncionalidadesCard />
          {heavyReady ? (
            <ClientesCrmDashboardCard />
          ) : (
            <div className="mb-6 h-36 animate-pulse rounded-2xl bg-slate-100" />
          )}
          <div className="mb-6" data-tour="resgate-clientes">
            {heavyReady ? (
              <ResgateWhatsAppCard />
            ) : (
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            )}
          </div>
          <InstallAppLinkCard />
        </div>

        <AddToHomeScreenCard />
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#047482]" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
