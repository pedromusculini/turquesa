export type TourStepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type TourStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  placement?: TourStepPlacement;
  /** Pula o passo se o alvo não existir ou estiver oculto */
  optional?: boolean;
};

export type SectionHint = {
  id: string;
  title: string;
  message: string;
};

export const PRIMEIROS_PASSOS_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    target: '[data-tour="dashboard-overview"]',
    title: 'Seu painel',
    description:
      'Aqui você vê o resumo do dia: sessões agendadas, faturamento do mês e clientes atendidos. Tudo em um só lugar.',
    placement: 'bottom',
  },
  {
    id: 'agenda',
    target: '[data-tour="nav-agenda"]',
    title: 'Agenda',
    description:
      'Agende sessões na grade, arraste horários e sincronize com o Google Calendar. Use "Nova sessão" para marcar rapidamente.',
    placement: 'bottom',
  },
  {
    id: 'clientes',
    target: '[data-tour="nav-clientes"]',
    title: 'Clientes',
    description:
      'Cadastre clientes, veja histórico de atendimentos e importe contatos do Google. Os dados ficam no seu Google Drive.',
    placement: 'bottom',
  },
  {
    id: 'catalogo',
    target: '[data-tour="nav-catalogo"]',
    title: 'Catálogo',
    description:
      'Cadastre serviços (corte, coloração, unhas…) com preço e duração, e gerencie profissionais da equipe.',
    placement: 'bottom',
  },
  {
    id: 'comunicacao',
    target: '[data-tour="lembretes-whatsapp"]',
    title: 'Lembretes WhatsApp',
    description:
      'Envie lembretes de sessão pelo WhatsApp com mensagens prontas. Configure modelos em Configurações → Mensagens.',
    placement: 'bottom',
    optional: true,
  },
  {
    id: 'financeiro',
    target: '[data-tour="nav-financeiro"]',
    title: 'Financeiro',
    description:
      'Acompanhe receitas, comissões das profissionais e relatórios do salão após finalizar atendimentos.',
    placement: 'bottom',
  },
  {
    id: 'google',
    target: '[data-tour="nav-backup"]',
    title: 'Google (Drive, Calendar, Contatos)',
    description:
      'Em Backup conecte o Google Drive para guardar seus dados. Na Agenda e em Clientes você conecta Calendar e Contatos.',
    placement: 'bottom',
  },
  {
    id: 'pwa',
    target: '[data-tour="pwa-install"]',
    title: 'Instalar no celular',
    description:
      'Adicione o Turquesa Agenda à tela inicial e use como app — acesso rápido à agenda no salão.',
    placement: 'top',
    optional: true,
  },
];

export const SECTION_HINTS: SectionHint[] = [
  {
    id: 'hint-dashboard-stats',
    title: 'Resumo do dia',
    message: 'Os números atualizam conforme você agenda e finaliza sessões.',
  },
  {
    id: 'hint-agenda-nova-sessao',
    title: 'Nova sessão',
    message: 'Clique em um horário vazio na grade ou use o botão "Nova sessão" no topo.',
  },
  {
    id: 'hint-clientes-cadastro',
    title: 'Cadastro de clientes',
    message: 'Busque por nome ou cadastre um novo cliente antes de agendar.',
  },
  {
    id: 'hint-catalogo-servicos',
    title: 'Serviços',
    message: 'Cadastre preço e duração de cada serviço — isso alimenta a agenda e o financeiro.',
  },
  {
    id: 'hint-comunicacao-lembretes',
    title: 'Lembretes',
    message: 'Personalize mensagens em Configurações e envie lembretes com um clique.',
  },
];

export const TOUR_STORAGE_KEY = 'turquesa-tour-prefs';

export function findVisibleTourTarget(selector: string): Element | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    const el = node as HTMLElement;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    ) {
      return el;
    }
  }
  return nodes[0] ?? null;
}
