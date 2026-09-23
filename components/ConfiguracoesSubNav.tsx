'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CONFIGURACOES_NAV,
  SETTINGS_GROUPS,
  type ConfiguracoesTab,
  isConfiguracoesHub,
  resolveConfiguracoesTab,
} from '@/lib/nav';

export type { ConfiguracoesTab };
export { CONFIGURACOES_NAV, resolveConfiguracoesTab };

export default function ConfiguracoesSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const active = resolveConfiguracoesTab(pathname, tabParam);

  if (isConfiguracoesHub(pathname, tabParam)) {
    return null;
  }

  return (
    <nav className="mb-2 hidden lg:sticky lg:top-20 lg:block" aria-label="Seções de configurações">
      <div className="space-y-4">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-muted-2)]">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.Icon;
                const isActive = active === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      prefetch
                      scroll={false}
                      data-tour={item.tour}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium ${
                        isActive
                          ? 'bg-[var(--app-surface)] text-[var(--brand-primary)] shadow-sm'
                          : 'text-[var(--app-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
