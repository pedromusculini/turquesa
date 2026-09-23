import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  Clock,
  CreditCard,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Palette,
  Settings,
  Shield,
  User,
  Users,
  Wallet,
} from 'lucide-react';

export type ConfiguracoesTab =
  | 'hub'
  | 'presenca'
  | 'mensagens'
  | 'horarios'
  | 'link'
  | 'pagamento'
  | 'agenda'
  | 'equipe'
  | 'anamnese'
  | 'seguranca'
  | 'aparencia';

export type AppNavItem = {
  href: string;
  label: string;
  hint?: string;
  Icon: LucideIcon;
  tour?: string;
};

export const PRIMARY_MOBILE_TABS: AppNavItem[] = [
  { href: '/dashboard', label: 'Início', Icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', Icon: Calendar, tour: 'nav-agenda' },
  { href: '/clientes', label: 'Clientes', Icon: Users, tour: 'nav-clientes' },
  { href: '/financeiro', label: 'Caixa', Icon: Wallet, tour: 'nav-financeiro' },
];

export const DESKTOP_NAV: AppNavItem[] = [
  { href: '/dashboard', label: 'Início', Icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', Icon: Calendar, tour: 'nav-agenda' },
  { href: '/clientes', label: 'Clientes', Icon: Users, tour: 'nav-clientes' },
  { href: '/dashboard/catalogo', label: 'Catálogo', Icon: BookOpen, tour: 'nav-catalogo' },
  { href: '/financeiro', label: 'Financeiro', Icon: Wallet, tour: 'nav-financeiro' },
];

export const MAIS_GROUPS: { title: string; items: AppNavItem[] }[] = [
  {
    title: 'Dia a dia',
    items: [
      {
        href: '/dashboard/catalogo',
        label: 'Catálogo',
        hint: 'Serviços, preços e duração',
        Icon: BookOpen,
        tour: 'nav-catalogo',
      },
      {
        href: '/clientes/relatorio',
        label: 'Relatório de clientes',
        hint: 'Quem voltou e quem sumiu',
        Icon: BarChart3,
      },
      {
        href: '/dashboard/configuracoes/presenca',
        label: 'Site do salão',
        hint: 'Página pública para clientes',
        Icon: Globe,
        tour: 'nav-presenca',
      },
    ],
  },
  {
    title: 'Ajustes',
    items: [
      {
        href: '/dashboard/configuracoes',
        label: 'Configurações',
        hint: 'Mensagens, horários, equipe',
        Icon: Settings,
        tour: 'nav-configuracoes',
      },
      {
        href: '/dashboard/perfil',
        label: 'Meu perfil',
        hint: 'Nome, endereço e WhatsApp',
        Icon: User,
      },
      {
        href: '/dashboard/conta',
        label: 'Minha conta',
        hint: 'Plano e pagamento',
        Icon: CreditCard,
      },
      {
        href: '/backup',
        label: 'Backup',
        hint: 'Exportar e restaurar dados',
        Icon: Archive,
        tour: 'nav-backup',
      },
    ],
  },
  {
    title: 'Ajuda',
    items: [
      {
        href: '/dashboard/guia',
        label: 'Guia do sistema',
        hint: 'Como usar cada tela',
        Icon: HelpCircle,
      },
    ],
  },
];

export type SettingsNavItem = {
  id: ConfiguracoesTab;
  label: string;
  hint: string;
  href: string;
  Icon: LucideIcon;
  tour?: string;
};

export const SETTINGS_GROUPS: { title: string; items: SettingsNavItem[] }[] = [
  {
    title: 'Para as clientes',
    items: [
      {
        id: 'mensagens',
        label: 'Mensagens WhatsApp',
        hint: 'Convites, confirmações e lembretes',
        href: '/dashboard/configuracoes?tab=mensagens',
        Icon: MessageSquare,
        tour: 'config-tab-mensagens',
      },
      {
        id: 'horarios',
        label: 'Horários',
        hint: 'Dias e faixas de atendimento',
        href: '/dashboard/configuracoes?tab=horarios',
        Icon: Clock,
        tour: 'config-tab-horarios',
      },
      {
        id: 'link',
        label: 'Links públicos',
        hint: 'Agendar, cadastro e vitrine',
        href: '/dashboard/configuracoes?tab=link',
        Icon: Link2,
        tour: 'config-tab-link',
      },
      {
        id: 'presenca',
        label: 'Site do salão',
        hint: 'Página com capa e cores',
        href: '/dashboard/configuracoes/presenca',
        Icon: Globe,
        tour: 'config-tab-presenca',
      },
    ],
  },
  {
    title: 'Do salão',
    items: [
      {
        id: 'agenda',
        label: 'Agenda',
        hint: 'Duração padrão das sessões',
        href: '/dashboard/configuracoes/agenda',
        Icon: Calendar,
        tour: 'config-tab-agenda',
      },
      {
        id: 'equipe',
        label: 'Equipe',
        hint: 'Profissionais e comissão',
        href: '/dashboard/configuracoes/equipe',
        Icon: Users,
        tour: 'config-tab-equipe',
      },
      {
        id: 'pagamento',
        label: 'Pagamento e taxas',
        hint: 'PIX, cartão e categorias',
        href: '/dashboard/configuracoes/pagamento',
        Icon: Wallet,
        tour: 'config-tab-pagamento',
      },
      {
        id: 'anamnese',
        label: 'Anamnese',
        hint: 'Perguntas da ficha da cliente',
        href: '/dashboard/configuracoes/anamnese',
        Icon: ClipboardList,
        tour: 'config-tab-anamnese',
      },
    ],
  },
  {
    title: 'App e segurança',
    items: [
      {
        id: 'aparencia',
        label: 'Aparência',
        hint: 'Claro, escuro e cores',
        href: '/dashboard/configuracoes/aparencia',
        Icon: Palette,
      },
      {
        id: 'seguranca',
        label: 'Segurança',
        hint: 'PIN do financeiro',
        href: '/dashboard/configuracoes/seguranca',
        Icon: Shield,
        tour: 'config-tab-seguranca',
      },
    ],
  },
];

export const CONFIGURACOES_NAV: { id: ConfiguracoesTab; label: string; href: string }[] =
  SETTINGS_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ id: item.id, label: item.label, href: item.href })),
  );

export function resolveConfiguracoesTab(
  pathname: string,
  tabParam: string | null,
): ConfiguracoesTab {
  if (pathname.startsWith('/dashboard/configuracoes/aparencia')) return 'aparencia';
  if (pathname.startsWith('/dashboard/configuracoes/presenca')) return 'presenca';
  if (pathname.startsWith('/dashboard/configuracoes/anamnese')) return 'anamnese';
  if (pathname.startsWith('/dashboard/configuracoes/seguranca')) return 'seguranca';
  if (pathname.startsWith('/dashboard/configuracoes/equipe')) return 'equipe';
  if (pathname.startsWith('/dashboard/configuracoes/pagamento')) return 'pagamento';
  if (pathname.startsWith('/dashboard/configuracoes/agenda')) return 'agenda';
  if (tabParam === 'horarios') return 'horarios';
  if (tabParam === 'link') return 'link';
  if (tabParam === 'mensagens') return 'mensagens';
  if (pathname === '/dashboard/configuracoes') return 'hub';
  return 'hub';
}

export function isConfiguracoesHub(pathname: string, tabParam: string | null): boolean {
  return resolveConfiguracoesTab(pathname, tabParam) === 'hub';
}

export function isNavActive(pathname: string, href: string): boolean {
  const path = href.split('?')[0];
  if (path === '/dashboard') return pathname === '/dashboard';
  if (path === '/clientes') return pathname === '/clientes';
  if (path === '/dashboard/configuracoes/presenca') {
    return pathname.startsWith('/dashboard/configuracoes/presenca');
  }
  if (path === '/dashboard/configuracoes') {
    return (
      pathname === '/dashboard/configuracoes' ||
      pathname.startsWith('/dashboard/configuracoes/')
    );
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isMaisSectionActive(
  pathname: string,
  opts: { catalogoInPrimary?: boolean } = {},
): boolean {
  if (!opts.catalogoInPrimary && pathname.startsWith('/dashboard/catalogo')) return true;
  return (
    pathname.startsWith('/clientes/relatorio') ||
    pathname.startsWith('/dashboard/configuracoes') ||
    pathname.startsWith('/dashboard/perfil') ||
    pathname.startsWith('/dashboard/conta') ||
    pathname.startsWith('/dashboard/guia') ||
    pathname.startsWith('/backup')
  );
}

export function findSettingsItem(id: ConfiguracoesTab): SettingsNavItem | undefined {
  return SETTINGS_GROUPS.flatMap((group) => group.items).find((item) => item.id === id);
}
