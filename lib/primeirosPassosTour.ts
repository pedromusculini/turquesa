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
      'Aqui você acompanha o dia: agenda de hoje, lembretes WhatsApp e atalhos para o restante do sistema.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'atendimento-avulso',
    target: '[data-tour="atendimento-avulso"]',
    title: 'Atendimento avulso',
    description:
      'Cliente sem horário na grade? Use este atalho para finalizar um atendimento na hora — escolha serviços, pagamento e comissão.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'guia-docs',
    target: '[data-tour="guia-funcionalidades"]',
    title: 'Guia completo',
    description:
      'Este card leva ao guia com todas as funcionalidades e passos de configuração. Você pode voltar aqui quando quiser.',
    placement: 'bottom',
    route: '/dashboard',
    optional: true,
  },
  {
    id: 'google',
    target: '[data-tour="google-integracao"]',
    title: 'Google Drive, Calendar e Contatos',
    description:
      'Conecte sua conta Google para guardar fichas no Drive, sincronizar sessões no Calendar e importar contatos, cadastros e reservas online.',
    placement: 'top',
    route: '/dashboard',
  },
  {
    id: 'autocadastro',
    target: '[data-tour="autocadastro-link"]',
    title: 'Autocadastro de clientes',
    description:
      'Gere um link para o cliente preencher a ficha sozinho. Depois importe os cadastros pelo card Google acima.',
    placement: 'top',
    route: '/dashboard',
    optional: true,
  },
  {
    id: 'catalogo-nav',
    target: '[data-tour="nav-catalogo"]',
    title: 'Catálogo',
    description:
      'Serviços e produtos são a base do sistema: alimentam horários na agenda, finalização de atendimentos e vitrine pública.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'catalogo-servicos',
    target: '[data-tour="catalogo-tab-servicos"]',
    title: 'Serviços e produtos',
    description:
      'Cadastre cortes, coloração, unhas e produtos com preço. Serviços precisam de duração — ela define os horários livres na agenda.',
    placement: 'bottom',
    route: '/dashboard/catalogo',
  },
  {
    id: 'catalogo-novo-servico',
    target: '[data-tour="catalogo-novo-servico"]',
    title: 'Cadastrar serviço',
    description:
      'Use "Novo serviço" para definir nome, preço e tempo. Adicione fotos para aparecer na vitrine pública (/c).',
    placement: 'bottom',
    route: '/dashboard/catalogo',
  },
  {
    id: 'config-equipe-tab',
    target: '[data-tour="config-tab-equipe"]',
    title: 'Equipe do salão',
    description:
      'Cadastre quem atende — nome, WhatsApp, comissão padrão e cor na grade da Agenda.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/equipe',
  },
  {
    id: 'catalogo-nova-profissional',
    target: '[data-tour="catalogo-nova-profissional"]',
    title: 'Nova profissional',
    description:
      'Clique aqui para adicionar membros da equipe. Defina a comissão e envie convite pelo WhatsApp para conectar a agenda Google.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/equipe',
  },
  {
    id: 'catalogo-cor-agenda',
    target: '[data-tour="catalogo-cor-agenda"]',
    title: 'Cores na agenda',
    description:
      'Ao cadastrar ou editar, escolha a cor de cada profissional. Na grade da Agenda fica fácil ver quem atende cada horário.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/equipe',
    optional: true,
  },
  {
    id: 'configuracoes-nav',
    target: '[data-tour="nav-configuracoes"]',
    title: 'Configurações',
    description:
      'Mensagens WhatsApp, horários, link público, taxas de cartão, anamnese e PIN — tudo centralizado aqui.',
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
    id: 'config-horarios',
    target: '[data-tour="config-tab-horarios"]',
    title: 'Horários de atendimento',
    description:
      'Informe dias e faixas em que o salão atende. Esses horários alimentam o agendamento online (/agendar).',
    placement: 'bottom',
    route: '/dashboard/configuracoes?tab=horarios',
  },
  {
    id: 'config-link-publico',
    target: '[data-tour="config-link-publico"]',
    title: 'Link público de agendamento',
    description:
      'Gere o link para clientes agendarem sozinhos. Também há links de formulário de cadastro e vitrine do catálogo.',
    placement: 'bottom',
    route: '/dashboard/configuracoes?tab=link',
  },
  {
    id: 'config-agenda-settings',
    target: '[data-tour="config-tab-agenda"]',
    title: 'Configurações da agenda',
    description:
      'Ajuste duração padrão de sessão e janela de visualização da grade.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/agenda',
    optional: true,
  },
  {
    id: 'config-taxas',
    target: '[data-tour="config-taxas-pagamento"]',
    title: 'Taxas de pagamento',
    description:
      'Informe a taxa de cada meio (PIX, débito, crédito…). Usado no repasse de comissões às profissionais após finalizar atendimentos.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/pagamento',
  },
  {
    id: 'config-anamnese',
    target: '[data-tour="config-tab-anamnese"]',
    title: 'Anamnese do cliente',
    description:
      'Personalize os campos da ficha de saúde/histórico que aparecem no cadastro de cada cliente.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/anamnese',
    optional: true,
  },
  {
    id: 'config-seguranca',
    target: '[data-tour="config-tab-seguranca"]',
    title: 'PIN de segurança',
    description:
      'Em modo salão, defina um PIN para proteger Financeiro e Backup. A equipe usa agenda e clientes sem o PIN.',
    placement: 'bottom',
    route: '/dashboard/configuracoes/seguranca',
    optional: true,
  },
  {
    id: 'agenda',
    target: '[data-tour="nav-agenda"]',
    title: 'Agenda',
    description:
      'Agende sessões na grade, arraste horários e sincronize com o Google Calendar. Finalize com catálogo e pagamento.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'agenda-nova-sessao',
    target: '[data-tour="agenda-nova-sessao"]',
    title: 'Nova sessão',
    description:
      'Clique em um horário vazio na grade ou use este formulário. Busque o cliente, escolha profissional e serviço.',
    placement: 'bottom',
    route: '/agenda',
    optional: true,
  },
  {
    id: 'agenda-sync',
    target: '[data-tour="agenda-sincronizar"]',
    title: 'Sincronizar dispositivos',
    description:
      'No computador, use "Sincronizar" após editar horários. No celular, a agenda atualiza ao reabrir o app. Se duplicar na primeira sync, sincronize de novo no desktop.',
    placement: 'left',
    route: '/agenda',
    optional: true,
  },
  {
    id: 'clientes',
    target: '[data-tour="nav-clientes"]',
    title: 'Clientes',
    description:
      'Fichas no seu Google Drive: histórico, observações, anamnese e pagamentos. Agende sessão ou use "Restaurar da agenda" se faltar histórico.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'lembretes-dashboard',
    target: '[data-tour="lembretes-whatsapp"]',
    title: 'Enviar lembretes',
    description:
      'Sessões D-7 e D-1 aparecem aqui. Toque para enviar pelo WhatsApp com os modelos que você configurou.',
    placement: 'bottom',
    route: '/dashboard',
    optional: true,
  },
  {
    id: 'financeiro',
    target: '[data-tour="nav-financeiro"]',
    title: 'Financeiro',
    description:
      'Receitas entram ao finalizar atendimentos. Filtre por período, profissional e cliente; exporte CSV.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'financeiro-repasse',
    target: '[data-tour="financeiro-repasse"]',
    title: 'Repasse às profissionais',
    description:
      'Nesta aba veja quanto ficou para cada profissional após taxa do cartão e comissão. Configure taxas em Pagamento e comissão em Equipe.',
    placement: 'bottom',
    route: '/financeiro',
    optional: true,
  },
  {
    id: 'nav-backup',
    target: '[data-tour="nav-backup"]',
    title: 'Backup',
    description:
      'Exporte CSV, baixe arquivos do Drive e restaure snapshots de clientes e financeiro.',
    placement: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'backup-overview',
    target: '[data-tour="backup-overview"]',
    title: 'Exportar e restaurar',
    description:
      'Snapshots automáticos protegem clientes e financeiro no Drive. A agenda gera um snapshot diário após sync completo.',
    placement: 'bottom',
    route: '/backup',
    optional: true,
  },
  {
    id: 'pwa',
    target: '[data-tour="pwa-install"]',
    title: 'Instalar no celular',
    description:
      'Adicione o Turquesa Agenda à tela inicial. Use no salão com a mesma conta — edite no desktop e veja no celular.',
    placement: 'top',
    route: '/dashboard',
    optional: true,
  },
];

export const SECTION_HINTS: SectionHint[] = [
  {
    id: 'hint-dashboard-stats',
    title: 'Resumo do dia',
    message: 'Acompanhe a agenda de hoje e finalize sessões direto do painel.',
  },
  {
    id: 'hint-agenda-nova-sessao',
    title: 'Nova sessão',
    message: 'Clique em um horário vazio na grade ou use o botão "Nova sessão" no topo.',
  },
  {
    id: 'hint-agenda-sync',
    title: 'Celular e computador',
    message:
      'Após alterar no desktop, toque em "Sincronizar". No celular, reabra a agenda ou aguarde ~1 min. Se duplicar alguma sessão na primeira vez, sincronize de novo no computador.',
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
      'Cadastre preço e duração de cada serviço — isso alimenta a agenda, o financeiro e a vitrine pública.',
  },
  {
    id: 'hint-config-equipe',
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
    id: 'hint-config-horarios',
    title: 'Horários públicos',
    message:
      'Defina dias e horários em que o salão atende — o cliente só vê slots livres nessas faixas.',
  },
  {
    id: 'hint-config-link',
    title: 'Agendamento online',
    message: 'Gere o link /agendar e compartilhe no Instagram ou WhatsApp.',
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
      'Ajuste os prazos em Configurações e envie lembretes de sessão pelo card no Dashboard, com um toque no WhatsApp.',
  },
  {
    id: 'hint-financeiro-repasse',
    title: 'Repasse',
    message: 'Confira a aba Repasse profissionais após finalizar atendimentos no período.',
  },
  {
    id: 'hint-backup',
    title: 'Proteção de dados',
    message: 'Backups automáticos no Drive antes de alterações importantes. Exporte CSV quando precisar.',
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
