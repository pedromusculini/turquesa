export type TourStepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type TourStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  placement?: TourStepPlacement;
  /** Pula o passo se o alvo não existir ou estiver oculto */
  optional?: boolean;
  /** Rota para abrir antes de destacar o alvo (multi-página) */
  route?: string;
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
    route: '/dashboard',
  },
  {
    id: 'agenda',
    target: '[data-tour="nav-agenda"]',
    title: 'Agenda',
    description:
      'Agende sessões na grade, arraste horários e sincronize com o Google Calendar. Use "Nova sessão" para marcar rapidamente.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'clientes',
    target: '[data-tour="nav-clientes"]',
    title: 'Clientes',
    description:
      'Cadastre clientes, veja histórico de atendimentos e importe contatos do Google. Os dados ficam no seu Google Drive.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'catalogo-nav',
    target: '[data-tour="nav-catalogo"]',
    title: 'Catálogo',
    description:
      'Serviços, produtos e profissionais ficam no Catálogo. É o primeiro passo para montar sua agenda e o financeiro.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'catalogo-servicos',
    target: '[data-tour="catalogo-tab-servicos"]',
    title: 'Serviços e produtos',
    description:
      'Na aba Serviços e produtos, cadastre cortes, coloração, unhas e outros itens com preço e duração.',
    placement: 'bottom',
    route: '/dashboard/catalogo',
  },
  {
    id: 'catalogo-novo-servico',
    target: '[data-tour="catalogo-novo-servico"]',
    title: 'Cadastrar serviço',
    description:
      'Use "Novo serviço" para definir nome, preço e tempo de atendimento. A duração alimenta os horários disponíveis na agenda.',
    placement: 'bottom',
    route: '/dashboard/catalogo',
  },
  {
    id: 'catalogo-profissionais-tab',
    target: '[data-tour="catalogo-tab-profissionais"]',
    title: 'Profissionais da equipe',
    description:
      'Na aba Profissionais, cadastre quem atende no salão — nome, WhatsApp, comissão e cor na agenda.',
    placement: 'bottom',
    route: '/dashboard/catalogo?tab=profissionais',
  },
  {
    id: 'catalogo-nova-profissional',
    target: '[data-tour="catalogo-nova-profissional"]',
    title: 'Cadastrar profissional',
    description:
      'Clique em "Nova profissional" para adicionar membros da equipe. Defina a comissão padrão e convide para conectar a agenda Google.',
    placement: 'bottom',
    route: '/dashboard/catalogo?tab=profissionais',
  },
  {
    id: 'catalogo-cor-agenda',
    target: '[data-tour="catalogo-cor-agenda"]',
    title: 'Cores na agenda',
    description:
      'Ao cadastrar ou editar, escolha a cor de cada profissional. Na grade da Agenda fica fácil ver quem atende cada horário.',
    placement: 'bottom',
    route: '/dashboard/catalogo?tab=profissionais',
  },
  {
    id: 'configuracoes-nav',
    target: '[data-tour="nav-configuracoes"]',
    title: 'Configurações',
    description:
      'Mensagens WhatsApp, horários de atendimento, taxas de cartão e link público — tudo em Configurações.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'config-mensagens',
    target: '[data-tour="config-mensagens-templates"]',
    title: 'Mensagens WhatsApp',
    description:
      'Personalize convites, confirmações e lembretes. Edite só o texto — nome, data e links são preenchidos automaticamente.',
    placement: 'bottom',
    route: '/dashboard/configuracoes',
  },
  {
    id: 'config-lembretes',
    target: '[data-tour="config-lembretes-prazos"]',
    title: 'Prazos dos lembretes',
    description:
      'Defina com quantos dias de antecedência as sessões aparecem no card de lembretes do Dashboard. O envio é manual pelo WhatsApp.',
    placement: 'bottom',
    route: '/dashboard/configuracoes',
  },
  {
    id: 'config-taxas',
    target: '[data-tour="config-taxas-pagamento"]',
    title: 'Taxas do cartão',
    description:
      'Informe a taxa de cada meio de pagamento (PIX, débito, crédito…). Usado no repasse de comissões às profissionais.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/pagamento',
  },
  {
    id: 'lembretes-dashboard',
    target: '[data-tour="lembretes-whatsapp"]',
    title: 'Enviar lembretes',
    description:
      'No Dashboard, envie lembretes de sessão com um toque no WhatsApp. As mensagens usam os modelos que você configurou.',
    placement: 'bottom',
    route: '/dashboard',
    optional: true,
  },
  {
    id: 'financeiro',
    target: '[data-tour="nav-financeiro"]',
    title: 'Financeiro',
    description:
      'Acompanhe receitas, comissões das profissionais e relatórios do salão após finalizar atendimentos.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'google',
    target: '[data-tour="nav-backup"]',
    title: 'Google (Drive, Calendar, Contatos)',
    description:
      'Em Backup conecte o Google Drive para guardar seus dados. Na Agenda e em Clientes você conecta Calendar e Contatos.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'pwa',
    target: '[data-tour="pwa-install"]',
    title: 'Instalar no celular',
    description:
      'Adicione o Turquesa Agenda à tela inicial e use como app — acesso rápido à agenda no salão.',
    placement: 'top',
    route: '/dashboard',
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
    title: 'Serviços e produtos',
    message:
      'Cadastre preço e duração de cada serviço — isso alimenta a agenda e o financeiro.',
  },
  {
    id: 'hint-catalogo-profissionais',
    title: 'Profissionais',
    message:
      'Cadastre a equipe com comissão e cor na agenda. Convide pelo WhatsApp para conectar o Google Calendar.',
  },
  {
    id: 'hint-config-mensagens',
    title: 'Mensagens WhatsApp',
    message:
      'Personalize convites, confirmações e lembretes. Salve no final para aplicar em todos os envios.',
  },
  {
    id: 'hint-config-taxas',
    title: 'Taxas de pagamento',
    message:
      'Informe a taxa de cada meio de recebimento para calcular corretamente o repasse às profissionais.',
  },
  {
    id: 'hint-comunicacao-lembretes',
    title: 'Lembretes',
    message:
      'Ajuste os prazos aqui e envie lembretes de sessão pelo card no Dashboard, com um toque no WhatsApp.',
  },
];

/** Compara rota do passo com a URL atual (pathname + query relevante). */
export function tourRouteMatches(stepRoute: string | undefined, pathname: string, search: string): boolean {
  if (!stepRoute) return true;

  const [expectedPath, expectedQuery = ''] = stepRoute.split('?');
  if (pathname !== expectedPath) return false;

  const expectedParams = new URLSearchParams(expectedQuery);
  const actualParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  for (const [key, value] of expectedParams.entries()) {
    if (actualParams.get(key) !== value) return false;
  }

  if (expectedPath === '/dashboard/catalogo' && !expectedParams.has('tab') && actualParams.get('tab')) {
    return false;
  }

  return true;
}

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
