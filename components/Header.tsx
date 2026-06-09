'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  BookOpen,
  Calendar,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { useCustomSession } from '@/lib/useSession';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import AddToHomeScreenButton from '@/components/AddToHomeScreenButton';
import AddToHomeScreenGuideHost from '@/components/AddToHomeScreenGuideHost';
import AddToHomeScreenNavItem from '@/components/AddToHomeScreenNavItem';
import PrimeirosPassosHelpButton from '@/components/PrimeirosPassosHelpButton';
import { BRAND } from '@/lib/visual/brand';

const { colors: CORES, productName: PRODUCT_NAME } = BRAND;

export const navLinks = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Início', Icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', shortLabel: 'Agenda', Icon: Calendar },
  { href: '/clientes', label: 'Clientes', shortLabel: 'Clientes', Icon: Users },
  { href: '/dashboard/catalogo', label: 'Catálogo', shortLabel: 'Catálogo', Icon: BookOpen },
  { href: '/financeiro', label: 'Financeiro', shortLabel: 'Financeiro', Icon: Wallet },
  { href: '/backup', label: 'Backup', shortLabel: 'Backup', Icon: Archive },
  {
    href: '/dashboard/configuracoes',
    label: 'Configurações',
    shortLabel: 'Config.',
    Icon: Settings,
  },
] as const;

const BRAND_PRIMARY = CORES.primary;
const BRAND_ACCENT = CORES.primaryHover;

function isNavActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAV_TOUR_IDS: Partial<Record<(typeof navLinks)[number]['href'], string>> = {
  '/agenda': 'nav-agenda',
  '/clientes': 'nav-clientes',
  '/dashboard/catalogo': 'nav-catalogo',
  '/financeiro': 'nav-financeiro',
  '/backup': 'nav-backup',
  '/dashboard/configuracoes': 'nav-configuracoes',
};

function BrandBlock() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandLogoIcon size={40} className="h-9 w-auto md:h-10" priority />
      <span className="truncate font-semibold text-gray-900 text-sm md:text-base">
        {PRODUCT_NAME}
      </span>
    </span>
  );
}

export default function Header() {
  const { data: session, status } = useCustomSession();
  const pathname = usePathname();
  const isAuthenticated = status === 'authenticated' && session?.user;
  const [mounted, setMounted] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setEmailVerified(false);
      return;
    }
    fetch('/api/auth/google-access/status')
      .then((r) => r.json())
      .then((data) => setEmailVerified(data.accessVerified === true))
      .catch(() => setEmailVerified(false));
  }, [isAuthenticated, status]);

  const handleLogout = async () => {
    const { signOut } = await import('next-auth/react');
    await signOut({ callbackUrl: '/login' });
  };

  const homeHref =
    isAuthenticated && emailVerified
      ? '/dashboard'
      : isAuthenticated
        ? '/auth/verificar-email'
        : '/';

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <BrandBlock />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-4">
        <Link href={homeHref} className="flex min-w-0 items-center gap-3 transition hover:opacity-80">
          <BrandBlock />
        </Link>

        {isAuthenticated ? (
          <div className="flex shrink-0 items-center gap-2 md:gap-6">
            {emailVerified && (
              <nav className="hidden items-center gap-1 md:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-tour={NAV_TOUR_IDS[link.href]}
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
              </nav>
            )}
            {!emailVerified && (
              <Link
                href="/auth/verificar-email"
                className="hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 md:inline-flex"
              >
                Confirme seu e-mail
              </Link>
            )}
            {emailVerified && (
              <Link
                href="/dashboard/perfil"
                title="Meu perfil"
                className={`flex items-center gap-2 rounded-xl p-1.5 transition ${
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
            )}
            {emailVerified === false && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200">
                <User className="h-5 w-5 text-gray-600" />
              </div>
            )}

            {emailVerified && <AddToHomeScreenButton />}

            {emailVerified && <PrimeirosPassosHelpButton />}

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 p-1.5 text-red-600 transition hover:text-red-700"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden text-sm font-medium md:inline">Sair</span>
            </button>
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

      {isAuthenticated && emailVerified && <AddToHomeScreenGuideHost />}

      {isAuthenticated && emailVerified && (
        <nav
          className="safe-area-pb border-t border-gray-100 bg-[var(--brand-bg-onboarding)]/60 px-2 py-2 md:hidden"
          aria-label="Atalhos principais"
        >
          <ul className="scrollbar-none flex gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch]">
            {navLinks.map((link) => {
              const active = isNavActive(pathname, link.href);
              const Icon = link.Icon;
              return (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    data-tour={NAV_TOUR_IDS[link.href]}
                    className={`flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-center transition ${
                      active ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-white'
                    }`}
                    style={active ? { backgroundColor: BRAND_PRIMARY } : undefined}
                  >
                    <Icon
                      className={`h-5 w-5 ${active ? 'text-white' : ''}`}
                      style={active ? undefined : { color: BRAND_ACCENT }}
                    />
                    <span className="text-[10px] font-semibold leading-tight">{link.shortLabel}</span>
                  </Link>
                </li>
              );
            })}
            <AddToHomeScreenNavItem />
          </ul>
        </nav>
      )}
    </header>
  );
}
