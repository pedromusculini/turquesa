'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, X } from 'lucide-react';
import { PRIMARY_MOBILE_TABS, isMaisSectionActive, isNavActive } from '@/lib/nav';
import MaisMenu from '@/components/MaisMenu';
import { acquireBodyScrollLock } from '@/lib/useBodyScrollLock';

export default function MobileBottomNav({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [maisOpen, setMaisOpen] = useState(false);
  const maisActive = isMaisSectionActive(pathname);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMaisOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!maisOpen) return;
    const release = acquireBodyScrollLock();
    closeBtnRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMaisOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      release();
      window.removeEventListener('keydown', onKey);
    };
  }, [maisOpen]);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur-md md:hidden"
        aria-label="Menu principal"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="grid h-[4.25rem] grid-cols-5">
          {PRIMARY_MOBILE_TABS.map((tab) => {
            const Icon = tab.Icon;
            const active = !maisOpen && isNavActive(pathname, tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  data-tour={tab.tour}
                  onClick={() => setMaisOpen(false)}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                    active ? 'text-[var(--brand-primary)]' : 'text-[var(--app-muted)]'
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              data-tour="nav-configuracoes"
              aria-expanded={maisOpen}
              aria-controls="mais-sheet"
              onClick={() => setMaisOpen((open) => !open)}
              className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                maisOpen || maisActive
                  ? 'text-[var(--brand-primary)]'
                  : 'text-[var(--app-muted)]'
              }`}
            >
              <LayoutGrid
                className="h-6 w-6"
                strokeWidth={maisOpen || maisActive ? 2.25 : 1.75}
              />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {maisOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fechar menu"
            onClick={() => setMaisOpen(false)}
          />
          <div
            id="mais-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mais-sheet-title"
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-[var(--brand-bg-page)] px-4 pb-8 pt-3 shadow-2xl"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--app-border)]" />
            <div className="mb-4 flex items-center justify-between">
              <h2 id="mais-sheet-title" className="text-lg font-bold text-[var(--app-text)]">
                Mais
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setMaisOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-surface-2)] text-[var(--app-text)]"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <MaisMenu onNavigate={() => setMaisOpen(false)} onLogout={onLogout} />
          </div>
        </div>
      ) : null}
    </>
  );
}
