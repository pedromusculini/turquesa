'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_PANEL_PATH } from '@/lib/constants';

const LINKS = [
  { href: ADMIN_PANEL_PATH, label: 'Contas', exact: true },
  { href: `${ADMIN_PANEL_PATH}/monitor`, label: 'Monitor' },
  { href: `${ADMIN_PANEL_PATH}/bugs`, label: 'Bugs' },
] as const;

export default function InternalAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-red-900/40 bg-zinc-950/90">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex gap-1 py-2 overflow-x-auto">
        {LINKS.map(({ href, label, ...rest }) => {
          const exact = 'exact' in rest && rest.exact;
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                active
                  ? 'bg-red-950/80 text-red-200 border border-red-800/60'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
