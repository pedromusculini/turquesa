// ============================================================
// Tipos centralizados do MedSupApp
// ============================================================

export type {
  ConsultationRecord,
  ConsultationRecord as ConsultationEvent,
  ConsultaStatus,
  TipoConsulta,
  FormaPagamentoConsulta,
  ConsultationPayment,
} from '@/lib/consultations';

// === Financeiro ===
export type Split = {
  id: string;
  transacao_id: string;
  medico: string;
  porcentagem: number;
  valor_split: number;
};

export type Transacao = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  data: string;
  valor: number;
  categoria: string | null;
  medico: string | null;
  observacao: string | null;
  created_at: string;
  splits: Split[];
};

// === Backup/Drive ===
export type DriveFile = {
  id: string;
  name: string;
  size?: string;
  mimeType?: string;
  createdTime?: string;
};

// === Onboarding ===
export type UserType = 'medico' | 'clinica';

export type OnboardingFormData = {
  fullName: string;
  crm: string;
  specialty: string;
  cnpj: string;
  doctorsCount: string;
  whatsapp: string;
  address: string;
  clinicName: string;
  healthPlan?: string;
};

// === Google Sync Status ===
export type SyncStatus = "idle" | "loading" | "success" | "error";

// === Clientes ===
export type ClienteStatusAtendimento =
  | 'agendado'
  | 'confirmado'
  | 'realizado'
  | 'cancelado'
  | 'faltou';

export type ClienteStatusPagamento = 'pago' | 'pendente' | 'parcial' | 'cancelado';

export type Cliente = {
  id: string;
  owner_email: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  convenio: string | null;
  observacoes_gerais: string | null;
  created_at: string;
  updated_at: string;
};

export type ClienteAtendimento = {
  id: string;
  cliente_id: string;
  data: string;
  hora: string | null;
  tipo: string;
  medico: string | null;
  valor: number | null;
  plano: string | null;
  status: ClienteStatusAtendimento;
  observacoes: string | null;
  created_at: string;
};

export type ClienteObservacao = {
  id: string;
  cliente_id: string;
  texto: string;
  autor: string | null;
  created_at: string;
};

export type ClientePagamento = {
  id: string;
  cliente_id: string;
  atendimento_id: string | null;
  valor: number;
  data: string;
  status: ClienteStatusPagamento;
  forma_pagamento: string | null;
  observacao: string | null;
  created_at: string;
};

export type ClienteDetalhe = Cliente & {
  atendimentos: ClienteAtendimento[];
  observacoes: ClienteObservacao[];
  pagamentos: ClientePagamento[];
};

export type PacienteOpcao = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  convenio: string | null;
  origem: 'drive' | 'google';
};
