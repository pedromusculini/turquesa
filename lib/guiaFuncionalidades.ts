import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BookOpen,
  Calendar,
  CalendarDays,
  CreditCard,
  HardDrive,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Shield,
  Smartphone,
  User,
  Users,
  Wallet,
} from 'lucide-react';

export type GuiaPasso = {
  texto: string;
};

export type GuiaSecao = {
  id: string;
  Icon: LucideIcon;
  titulo: string;
  resumo: string;
  oQueFaz: string[];
  comoConfigurar: GuiaPasso[];
  /** Rota interna do app (atalho no dashboard) */
  rotaApp?: string;
  rotaAppLabel?: string;
};

export const GUIA_INTRO = {
  titulo: 'Guia completo do Turquesa Agenda',
  subtitulo:
    'Tudo que o sistema oferece para salões e estúdios de beleza — e onde configurar cada parte, passo a passo.',
  dicaTour:
    'Prefere aprender na prática? No painel, toque no ícone de ajuda no topo para refazer o tour guiado.',
};

export const GUIA_SECOES: GuiaSecao[] = [
  {
    id: 'inicio',
    Icon: User,
    titulo: 'Conta, onboarding e perfil',
    resumo: 'Entrada com Google, trial de 30 dias e dados do salão.',
    oQueFaz: [
      'Login somente com Google (Calendar + Drive no primeiro acesso).',
      'Verificação de e-mail por código OTP.',
      'Onboarding: profissão, serviços, endereço, WhatsApp e CNPJ opcional.',
      'Meu Perfil: nome do salão, endereço, convite de agenda Google por profissional.',
    ],
    comoConfigurar: [
      { texto: 'Na primeira vez, complete o onboarding em /onboarding.' },
      { texto: 'Ajuste dados do salão em Dashboard → Meu Perfil.' },
      { texto: 'Convide profissionais para conectar a agenda Google pelo botão na lista da equipe.' },
    ],
    rotaApp: '/dashboard/perfil',
    rotaAppLabel: 'Abrir Meu Perfil',
  },
  {
    id: 'dashboard',
    Icon: LayoutDashboard,
    titulo: 'Dashboard',
    resumo: 'Visão do dia, atalhos e integrações em um só lugar.',
    oQueFaz: [
      'Agenda de hoje — finalize sessões sem sair do painel.',
      'Atendimento avulso — lança atendimento sem agendar antes.',
      'Lembretes WhatsApp — lista D-7 e D-1 com envio manual (wa.me).',
      'Google — conectar Drive, Calendar e Contatos; importar cadastros e agendamentos online.',
      'Links de autocadastro de clientes e instalação do app (PWA).',
    ],
    comoConfigurar: [
      { texto: 'Use o card verde “Atendimento avulso” para finalizar fora da grade.' },
      { texto: 'Em Links, conecte o Google e importe formulários ou reservas públicas.' },
      { texto: 'Copie o link de autocadastro e envie para novos clientes.' },
    ],
    rotaApp: '/dashboard',
    rotaAppLabel: 'Abrir Dashboard',
  },
  {
    id: 'agenda',
    Icon: Calendar,
    titulo: 'Agenda',
    resumo: 'Grade semanal, sessões, sync e finalização com catálogo.',
    oQueFaz: [
      'Nova sessão com busca de cliente, profissional, serviço e lembretes.',
      'Grade dia/semana no desktop; lista semanal no celular.',
      'Sync com Supabase e Google Calendar (botão Sincronizar no desktop).',
      'Finalizar sessão: itens do catálogo, desconto, pagamento e comissão → financeiro.',
      'Status visível: Finalizada, Cancelada ou Faltou.',
      'Sessões pendentes na lateral para finalizar depois.',
    ],
    comoConfigurar: [
      { texto: 'Cadastre serviços no Catálogo antes — a duração define os horários livres.' },
      { texto: 'Cadastre a equipe em Configurações → Equipe com cor na agenda.' },
      { texto: 'Após editar no computador, toque em Sincronizar; no celular, reabra a agenda.' },
      { texto: 'Ajuste duração padrão e janela em Configurações → Agenda.' },
    ],
    rotaApp: '/agenda',
    rotaAppLabel: 'Abrir Agenda',
  },
  {
    id: 'clientes',
    Icon: Users,
    titulo: 'Clientes',
    resumo: 'Fichas no Google Drive, histórico e agendamento rápido.',
    oQueFaz: [
      'Cadastro principal no seu Google Drive (clientes.json).',
      'Ficha com resumo, atendimentos, observações, pagamentos e anamnese.',
      'Agendar sessão com cliente pré-selecionado na Agenda.',
      'Formulário público (/f/token) e link pessoal de agendamento.',
      'Restaurar da agenda — importa sessões finalizadas sem duplicar no Financeiro.',
      'Proteção contra exclusão com sessão ativa; backup automático antes de apagar.',
    ],
    comoConfigurar: [
      { texto: 'Busque ou cadastre clientes em Clientes → Novo cliente.' },
      { texto: 'Use “Restaurar da agenda” na ficha se faltar histórico após sync.' },
      { texto: 'Importe contatos Google pelo card no Dashboard.' },
    ],
    rotaApp: '/clientes',
    rotaAppLabel: 'Abrir Clientes',
  },
  {
    id: 'catalogo',
    Icon: BookOpen,
    titulo: 'Catálogo',
    resumo: 'Serviços, produtos, fotos e vitrine pública.',
    oQueFaz: [
      'Serviços com duração e preço — usados na agenda e na finalização.',
      'Produtos com estoque opcional.',
      'Fotos por item (armazenamento Supabase).',
      'Vitrine pública em /c/token para clientes verem serviços.',
      'Itens aparecem ao finalizar atendimentos na agenda ou avulso.',
    ],
    comoConfigurar: [
      { texto: 'Dashboard → Catálogo → Novo serviço (nome, preço, duração).' },
      { texto: 'Adicione fotos no formulário do item para a vitrine.' },
      { texto: 'Copie o link da vitrine em Configurações → Link público.' },
    ],
    rotaApp: '/dashboard/catalogo',
    rotaAppLabel: 'Abrir Catálogo',
  },
  {
    id: 'equipe',
    Icon: CalendarDays,
    titulo: 'Equipe e comissões',
    resumo: 'Profissionais, cores na grade e convite Google Calendar.',
    oQueFaz: [
      'Cadastro de profissionais com WhatsApp, e-mail e comissão padrão.',
      'Cor por profissional na grade da Agenda.',
      'Convite WhatsApp para conectar agenda Google individual.',
      'Comissão usada no repasse ao finalizar atendimentos.',
    ],
    comoConfigurar: [
      { texto: 'Configurações → Equipe → Nova profissional.' },
      { texto: 'Defina percentual de comissão e escolha a cor na agenda.' },
      { texto: 'Envie o convite pelo WhatsApp para sincronizar o Calendar da profissional.' },
    ],
    rotaApp: '/dashboard/configuracoes/equipe',
    rotaAppLabel: 'Abrir Equipe',
  },
  {
    id: 'comunicacao',
    Icon: MessageCircle,
    titulo: 'Comunicação e lembretes',
    resumo: 'Templates WhatsApp com variáveis automáticas.',
    oQueFaz: [
      'Modelos: convite, confirmação, lembretes D-7 e D-1.',
      'Variáveis bloqueadas na UI — nome, data, horário e links são preenchidos sozinhos.',
      'Prazos dos lembretes no card do Dashboard.',
      'Envio manual via wa.me (sem API Meta).',
    ],
    comoConfigurar: [
      { texto: 'Configurações → Mensagens — edite só o texto e salve no final.' },
      { texto: 'Ajuste “dias antes da sessão” nos prazos dos lembretes.' },
      { texto: 'No Dashboard, toque em Enviar no card de lembretes.' },
    ],
    rotaApp: '/dashboard/configuracoes',
    rotaAppLabel: 'Abrir Mensagens',
  },
  {
    id: 'links-publicos',
    Icon: Link2,
    titulo: 'Links públicos e agendamento online',
    resumo: 'Cliente agenda sozinho; você importa no app.',
    oQueFaz: [
      'Formulário de cadastro (/f/token) e vitrine de catálogo (/c/token).',
      'Agendamento online (/agendar/slug) com horários livres reais.',
      'Cliente identifica por telefone ou link pessoal (?p=token).',
      'Confirmação cria sessão na agenda e evento no Google Calendar.',
      'Link para adicionar ao calendário do cliente ({{link_calendario}}).',
    ],
    comoConfigurar: [
      { texto: 'Configurações → Horários — defina dias e faixas de atendimento.' },
      { texto: 'Configurações → Link público — gere o slug e copie o link de agendamento.' },
      { texto: 'No Dashboard, importe cadastros e reservas pelo card Google.' },
    ],
    rotaApp: '/dashboard/configuracoes?tab=link',
    rotaAppLabel: 'Abrir Link público',
  },
  {
    id: 'financeiro',
    Icon: Wallet,
    titulo: 'Financeiro e repasse',
    resumo: 'Receitas, despesas, gráficos e divisão salão × profissional.',
    oQueFaz: [
      'Transações geradas ao finalizar atendimentos.',
      'Nova entrada ou nova despesa manualmente no Financeiro.',
      'Categorias de despesa personalizáveis (aluguel, material, comissões…).',
      'Edição de saídas (despesas) já lançadas.',
      'Filtros por período, profissional e cliente.',
      'Aba Repasse profissionais — comissão após taxa do meio de pagamento.',
      'Visão gráfica e exportação CSV/PNG.',
      'Espelho no Google Drive com backup automático.',
    ],
    comoConfigurar: [
      { texto: 'Configurações → Pagamento e taxas — informe taxa de PIX, débito, crédito etc.' },
      { texto: 'Defina comissão padrão em Configurações → Equipe.' },
      { texto: 'Finalize sessões na Agenda para lançar entradas automaticamente.' },
      { texto: 'Configurações → Pagamento e taxas — personalize categorias de despesa.' },
      { texto: 'Use + Nova despesa para lançar; edite depois se precisar.' },
      { texto: 'Em Financeiro → Repasse profissionais, confira valores do período.' },
    ],
    rotaApp: '/financeiro',
    rotaAppLabel: 'Abrir Financeiro',
  },
  {
    id: 'google',
    Icon: HardDrive,
    titulo: 'Google Drive, Calendar e Contatos',
    resumo: 'Seus dados ficam na sua conta Google.',
    oQueFaz: [
      'Drive — fichas de clientes e espelho do financeiro.',
      'Calendar — sessões sincronizadas com a agenda do salão.',
      'Contatos — importação de telefones para cadastros e lembretes.',
      'Snapshots automáticos de clientes e financeiro no Drive.',
    ],
    comoConfigurar: [
      { texto: 'No Dashboard → Links, toque em Conectar Google.' },
      { texto: 'Use os botões de importar cadastros, agendamentos ou contatos.' },
      { texto: 'Na Agenda, sincronize para enviar sessões ao Calendar.' },
    ],
    rotaApp: '/dashboard',
    rotaAppLabel: 'Conectar no Dashboard',
  },
  {
    id: 'backup',
    Icon: Archive,
    titulo: 'Backup e exportação',
    resumo: 'CSV, arquivos do Drive e restauração de snapshots.',
    oQueFaz: [
      'Export CSV de agenda e financeiro filtrado.',
      'Download de clientes.json, faturamento.json etc.',
      'Snapshots automáticos antes de salvar clientes/financeiro (6 em 6 h).',
      'Snapshot diário da agenda após sync completo (30 dias).',
      'Restaurar backup de clientes ou financeiro na página Backup.',
    ],
    comoConfigurar: [
      { texto: 'Menu Backup — conecte o Drive se ainda não conectou.' },
      { texto: 'Use Exportar CSV ou baixe arquivos principais.' },
      { texto: 'Para restaurar, escolha um snapshot na lista e confirme.' },
    ],
    rotaApp: '/backup',
    rotaAppLabel: 'Abrir Backup',
  },
  {
    id: 'anamnese-seguranca',
    Icon: Shield,
    titulo: 'Anamnese e segurança',
    resumo: 'Ficha de saúde do cliente e PIN do modo salão.',
    oQueFaz: [
      'Campos de anamnese personalizáveis na ficha do cliente.',
      'PIN financeiro para proteger Financeiro e Backup em modo salão.',
      'Equipe acessa agenda e clientes; áreas sensíveis pedem PIN.',
    ],
    comoConfigurar: [
      { texto: 'Configurações → Anamnese — ative campos e textos.' },
      { texto: 'Configurações → Segurança — defina ou altere o PIN.' },
    ],
    rotaApp: '/dashboard/configuracoes/seguranca',
    rotaAppLabel: 'Abrir Segurança',
  },
  {
    id: 'conta',
    Icon: CreditCard,
    titulo: 'Minha conta e assinatura',
    resumo: 'Plano ilimitado, trial e pagamento Asaas.',
    oQueFaz: [
      'Plano único ilimitado — até 999 profissionais.',
      'Trial 30 dias; cobrança via Asaas (PIX, cartão, boleto).',
      'Status da assinatura e link de pagamento.',
    ],
    comoConfigurar: [
      { texto: 'Dashboard → Minha conta (menu do perfil) para ver status.' },
      { texto: 'Use o link Asaas para renovar quando o trial ou período expirar.' },
    ],
    rotaApp: '/dashboard/conta',
    rotaAppLabel: 'Abrir Minha conta',
  },
  {
    id: 'app',
    Icon: Smartphone,
    titulo: 'App no celular (PWA)',
    resumo: 'Instale na tela inicial e use no salão.',
    oQueFaz: [
      'Funciona como app instalado no Android e iPhone.',
      'Agenda sincroniza entre celular e computador.',
      'Atualização leve ao voltar para a aba (~45 s de cooldown).',
    ],
    comoConfigurar: [
      { texto: 'No Dashboard, use o card “Instalar app” ou o botão no topo.' },
      { texto: 'No iPhone: Compartilhar → Adicionar à Tela de Início.' },
      { texto: 'No Android: menu do navegador → Instalar app.' },
    ],
    rotaApp: '/instalar',
    rotaAppLabel: 'Ver instruções de instalação',
  },
];

export const GUIA_ORDEM_CONFIGURACAO = [
  'Complete o onboarding e Meu Perfil.',
  'Cadastre serviços no Catálogo (preço e duração).',
  'Cadastre a equipe em Configurações → Equipe.',
  'Conecte o Google no Dashboard.',
  'Personalize mensagens WhatsApp e horários de atendimento.',
  'Gere o link público de agendamento e compartilhe.',
  'Agende a primeira sessão na Agenda.',
  'Configure taxas de pagamento para o repasse correto.',
];
