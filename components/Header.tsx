'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, LogOut, User, X } from 'lucide-react';
import { useCustomSession } from '@/lib/useSession';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import AddToHomeScreenButton from '@/components/AddToHomeScreenButton';
import AddToHomeScreenGuideHost from '@/components/AddToHomeScreenGuideHost';
import PrimeirosPassosHelpButton from '@/components/PrimeirosPassosHelpButton';
import GuiaFuncionalidadesHeaderButton from '@/components/GuiaFuncionalidadesHeaderButton';
import ModoSalaoHeaderButton from '@/components/ModoSalaoHeaderButton';
import MobileBottomNav from '@/components/MobileBottomNav';
import MaisMenu from '@/components/MaisMenu';
import {
  DESKTOP_NAV,
  MAIS_GROUPS,
  PRIMARY_MOBILE_TABS,
  isMaisSectionActive,
  isNavActive,
} from '@/lib/nav';
import { useDismissableLayer } from '@/lib/useDismissableLayer';
import { BRAND } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME } = BRAND;
const BRAND_PRIMARY = 'var(--brand-primary)';
const BRAND_ACCENT = 'var(--brand-primary-hover)';

function BrandBlock() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandLogoIcon size={40} className="h-9 w-auto md:h-10" priority />
      <span className="truncate text-sm font-semibold text-gray-900 md:text-base">
        {PRODUCT_NAME}
      </span>
    </span>
  );
}

export default function Header() {
  const { data: session, status } = useCustomSession();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = status === 'authenticated' && session?.user;
  const [mounted, setMounted] = useState(false);
  const [desktopMaisOpen, setDesktopMaisOpen] = useState(false);
  const maisRootRef = useRef<HTMLDivElement>(null);
  const maisPanelRef = useRef<HTMLDivElement>(null);

  useDismissableLayer({
    open: desktopMaisOpen,
    onClose: () => setDesktopMaisOpen(false),
    rootRef: maisRootRef,
    floatingRef: maisPanelRef,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDesktopMaisOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated) return;
    for (const link of [...PRIMARY_MOBILE_TABS, ...DESKTOP_NAV]) {
      router.prefetch(link.href);
    }
    for (const group of MAIS_GROUPS) {
      for (const item of group.items) {
        router.prefetch(item.href);
      }
    }
  }, [isAuthenticated, router]);

  const handleLogout = async () => {
    const { clearConsultationsStorage } = await import('@/lib/consultations');
    clearConsultationsStorage(session?.user?.email ?? null);
    const { signOut } = await import('next-auth/react');
    await signOut({ callbackUrl: '/login' });
  };

  const homeHref = isAuthenticated ? '/dashboard' : '/';
  const maisActive = isMaisSectionActive(pathname, { catalogoInPrimary: true });

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-8 md:py-4">
          <BrandBlock />
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-4">
          <Link href={homeHref} className="flex min-w-0 items-center gap-3 transition hover:opacity-80">
            <BrandBlock />
          </Link>

          {isAuthenticated ? (
            <div className="flex shrink-0 items-center gap-2 md:gap-4">
              <nav className="hidden items-center gap-1 md:flex" aria-label="Menu principal">
                {DESKTOP_NAV.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-tour={link.tour}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isNavActive(pathname, link.href)
                        ? 'text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    style={
                      isNavActive(pathname, link.href)
                        ? { backgroundColor: BRAND_ACCENT }
                        : undefined
                    }
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="relative" ref={maisRootRef}>
                  <button
                    type="button"
                    data-tour="nav-configuracoes"
                    aria-expanded={desktopMaisOpen}
                    onClick={() => setDesktopMaisOpen((open) => !open)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      desktopMaisOpen || maisActive
                        ? 'text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    style={
                      desktopMaisOpen || maisActive
                        ? { backgroundColor: BRAND_ACCENT }
                        : undefined
                    }
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Mais
                  </button>
                  {desktopMaisOpen ? (
                    <div
                      ref={maisPanelRef}
                      className="absolute right-0 top-full z-50 mt-2 max-h-[min(80vh,36rem)] w-[22rem] overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--brand-bg-page)] p-4 shadow-xl"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-[var(--app-text)]">Mais opções</p>
                        <button
                          type="button"
                          onClick={() => setDesktopMaisOpen(false)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-muted)] hover:bg-[var(--app-surface-2)]"
                          aria-label="Fechar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <MaisMenu
                        onNavigate={() => setDesktopMaisOpen(false)}
                        onLogout={handleLogout}
                      />
                    </div>
                  ) : null}
                </div>
              </nav>

              <Link
                href="/dashboard/perfil"
                title="Meu perfil"
                className={`hidden items-center gap-2 rounded-xl p-1.5 transition md:flex ${
                  isNavActive(pathname, '/dashboard/perfil')
                    ? 'ring-1 ring-[var(--brand-primary)]/25'
                    : 'hover:bg-gray-50'
                }`}
                style={
                  isNavActive(pathname, '/dashboard/perfil')
                    ? { backgroundColor: `${BRAND_ACCENT}18` }
                    : undefined
                }
              >
                <div className="hidden max-w-[140px] text-right lg:block">
                  <p className="truncate text-sm font-medium text-gray-800">{session.user?.name}</p>
                  <p className="truncate text-xs text-gray-500">{session.user?.email}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
              </Link>

              <div className="hidden items-center gap-2 md:flex">
                <ModoSalaoHeaderButton />
                <AddToHomeScreenButton />
                <GuiaFuncionalidadesHeaderButton />
                <PrimeirosPassosHelpButton />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 p-1.5 text-red-600 transition hover:text-red-700"
                  aria-label="Sair"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden text-sm font-medium lg:inline">Sair</span>
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
              style={{ backgroundColor: BRAND_PRIMARY }}
            >
              Entrar
            </Link>
          )}
        </div>

        {isAuthenticated && <AddToHomeScreenGuideHost />}
      </header>

      {isAuthenticated ? <MobileBottomNav onLogout={handleLogout} /> : null}
    </>
  );
}
