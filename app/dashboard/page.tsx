'use client';

import { useSession } from 'next-auth/react';
import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
import AppBootSplash from '@/components/AppBootSplash';

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
    return <AppBootSplash label="Abrindo o painel…" />;
  }

  if (status === 'unauthenticated' || !session) return null;

  const firstName = session.user?.name?.split(' ')[0] || 'olá';

  return (
    <div className="min-h-[calc(100vh-73px)]">
      <main className="mx-auto min-w-0 px-4 py-4 lg:max-w-6xl lg:p-8">
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
        <AppBootSplash label="Abrindo o painel…" />
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
