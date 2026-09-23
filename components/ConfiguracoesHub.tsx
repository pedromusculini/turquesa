'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SETTINGS_GROUPS } from '@/lib/nav';

export default function ConfiguracoesHub() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--app-text)]">Configurações</h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          Tudo em um lugar: o que as clientes veem, a equipe e o visual do app.
        </p>
      </div>

      <div className="space-y-6">
        {SETTINGS_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted-2)]">
              {group.title}
            </h2>
            <ul className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              {group.items.map((item, index) => {
                const Icon = item.Icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      data-tour={item.tour}
                      className={`flex min-h-14 items-center gap-3 px-4 py-3 active:bg-[var(--app-surface-2)] ${
                        index > 0 ? 'border-t border-[var(--app-border)]' : ''
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-bg-onboarding)] text-[var(--brand-primary)]">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[var(--app-text)]">
                          {item.label}
                        </span>
                        <span className="block text-xs text-[var(--app-muted)]">{item.hint}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--app-muted-2)]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
