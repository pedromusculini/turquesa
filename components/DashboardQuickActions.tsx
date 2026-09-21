'use client';

import Link from 'next/link';
import { BookOpen, Calendar, CheckCircle2, Clock } from 'lucide-react';

const ACTIONS = [
  {
    href: '/agenda',
    label: 'Agenda',
    detail: 'Ver e marcar',
    icon: Calendar,
  },
  {
    href: '/clientes?finalizar=1',
    label: 'Avulso',
    detail: 'Lançar agora',
    icon: CheckCircle2,
    tour: 'atendimento-avulso',
  },
  {
    href: '/dashboard/catalogo',
    label: 'Serviços',
    detail: 'Preço e tempo',
    icon: BookOpen,
  },
  {
    href: '/dashboard/configuracoes?tab=horarios',
    label: 'Horários',
    detail: 'Quando atende',
    icon: Clock,
  },
] as const;

export default function DashboardQuickActions() {
  return (
    <nav
      aria-label="Atalhos do painel"
      className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            data-tour={'tour' in action ? action.tour : undefined}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-3 shadow-sm active:bg-[#eef4f5] sm:flex-col sm:items-start sm:gap-2 sm:p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef4f5] text-[#047482]">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">{action.label}</span>
              <span className="block text-xs text-gray-500">{action.detail}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
