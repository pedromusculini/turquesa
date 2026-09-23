'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LogOut } from 'lucide-react';
import { MAIS_GROUPS, isNavActive } from '@/lib/nav';
import AddToHomeScreenButton from '@/components/AddToHomeScreenButton';
import ModoSalaoHeaderButton from '@/components/ModoSalaoHeaderButton';
import PrimeirosPassosHelpButton from '@/components/PrimeirosPassosHelpButton';

type MaisMenuProps = {
  onNavigate?: () => void;
  onLogout: () => void;
};

export default function MaisMenu({ onNavigate, onLogout }: MaisMenuProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      {MAIS_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted-2)]">
            {group.title}
          </h3>
          <ul className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            {group.items.map((item, index) => {
              const Icon = item.Icon;
              const active = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-tour={item.tour}
                    onClick={onNavigate}
                    className={`flex min-h-14 items-center gap-3 px-4 py-3 ${
                      index > 0 ? 'border-t border-[var(--app-border)]' : ''
                    } ${
                      active
                        ? 'bg-[var(--brand-bg-onboarding)]'
                        : 'active:bg-[var(--app-surface-2)]'
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-bg-onboarding)] text-[var(--brand-primary)]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--app-text)]">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="block text-xs text-[var(--app-muted)]">{item.hint}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[var(--app-muted-2)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="space-y-2">
        <ModoSalaoHeaderButton variant="row" />
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
          <PrimeirosPassosHelpButton variant="row" />
        </div>
        <AddToHomeScreenButton variant="inline" />
      </section>

      <button
        type="button"
        onClick={onLogout}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-[var(--app-surface)] px-4 py-3 text-sm font-semibold text-red-600"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>

      <p className="px-1 text-center text-xs text-[var(--app-muted-2)]">
        <Link href="/privacidade" onClick={onNavigate} className="underline-offset-2 hover:underline">
          Privacidade
        </Link>
        {' · '}
        <Link href="/termos" onClick={onNavigate} className="underline-offset-2 hover:underline">
          Termos
        </Link>
      </p>
    </div>
  );
}
