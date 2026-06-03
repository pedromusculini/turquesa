'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  Calendar,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { useCustomSession } from '@/lib/useSession';

export const navLinks = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Início', Icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', shortLabel: 'Agenda', Icon: Calendar },
  { href: '/clientes', label: 'Clientes', shortLabel: 'Clientes', Icon: Users },
  { href: '/financeiro', label: 'Financeiro', shortLabel: 'Financeiro', Icon: Wallet },
  { href: '/backup', label: 'Backup', shortLabel: 'Backup', Icon: Archive },
  {
    href: '/dashboard/configuracoes',
    label: 'Configurações',
    shortLabel: 'Config.',
    Icon: Settings,
  },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
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
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 md:px-8 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#90EE90] text-white p-2 rounded-xl">
              <span className="text-xl">🩺</span>
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">MedSupAPP</h1>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <Link href={homeHref} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition">
          <div className="bg-[#90EE90] text-white p-2 md:p-3 rounded-xl shrink-0">
            <span className="text-xl md:text-2xl">🩺</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-gray-900 truncate">MedSupAPP</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Gestão para clínicas</p>
          </div>
        </Link>

        {isAuthenticated ? (
          <div className="flex items-center gap-2 md:gap-6 shrink-0">
            {emailVerified && (
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isNavActive(pathname, link.href)
                        ? 'bg-green-50 text-[#228B22]'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
            {!emailVerified && (
              <Link
                href="/auth/verificar-email"
                className="hidden md:inline-flex text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg"
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
                    ? 'bg-green-50 ring-1 ring-[#90EE90]/60'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="text-right hidden lg:block max-w-[140px]">
                  <p className="font-medium text-gray-800 text-sm truncate">
                    {session.user?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{session.user?.email}</p>
                </div>
                <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
              </Link>
            )}
            {emailVerified === false && (
              <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-red-600 hover:text-red-700 transition p-1.5"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline text-sm font-medium">Sair</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-[#013a01] px-3 py-2 text-sm font-medium text-white hover:bg-[#025201] transition shrink-0"
          >
            Entrar
          </Link>
        )}
      </div>

      {isAuthenticated && emailVerified && (
        <nav
          className="md:hidden border-t border-gray-100 bg-[#f8faf8] px-2 py-2 safe-area-pb"
          aria-label="Atalhos principais"
        >
          <ul className="flex gap-1.5 overflow-x-auto scrollbar-none [-webkit-overflow-scrolling:touch]">
            {navLinks.map((link) => {
              const active = isNavActive(pathname, link.href);
              const Icon = link.Icon;
              return (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    className={`flex flex-col items-center gap-0.5 min-w-[4.25rem] px-2 py-1.5 rounded-xl text-center transition ${
                      active
                        ? 'bg-[#013a01] text-white shadow-sm'
                        : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-[#228B22]'}`} />
                    <span className="text-[10px] font-semibold leading-tight">
                      {link.shortLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
