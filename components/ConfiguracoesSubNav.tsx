'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export type ConfiguracoesTab = 'mensagens' | 'horarios' | 'link' | 'pagamento';

export const CONFIGURACOES_NAV: { id: ConfiguracoesTab; label: string; href: string }[] = [
  { id: 'mensagens', label: 'Mensagens', href: '/dashboard/configuracoes' },
  { id: 'horarios', label: 'Horários', href: '/dashboard/configuracoes?tab=horarios' },
  { id: 'link', label: 'Link público', href: '/dashboard/configuracoes?tab=link' },
  { id: 'pagamento', label: 'Pagamento e taxas', href: '/dashboard/configuracoes/pagamento' },
];

export function resolveConfiguracoesTab(
  pathname: string,
  tabParam: string | null,
): ConfiguracoesTab {
  if (pathname.startsWith('/dashboard/configuracoes/pagamento')) return 'pagamento';
  if (tabParam === 'horarios') return 'horarios';
  if (tabParam === 'link') return 'link';
  return 'mensagens';
}

export default function ConfiguracoesSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = resolveConfiguracoesTab(pathname, searchParams.get('tab'));

  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
      {CONFIGURACOES_NAV.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`min-w-[88px] flex-1 whitespace-nowrap rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
            active === item.id ? 'bg-white text-[#228B22] shadow-sm' : 'text-gray-600'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
