export type AnamneseCampoTipo = 'texto_curto' | 'texto_longo' | 'sim_nao' | 'opcoes';

export type AnamneseCampo = {
  id: string;
  owner_email: string;
  ordem: number;
  label: string;
  tipo: AnamneseCampoTipo;
  opcoes: string[];
  obrigatorio: boolean;
};

export type AnamneseCampoInput = {
  id?: string;
  ordem: number;
  label: string;
  tipo: AnamneseCampoTipo;
  opcoes?: string[];
  obrigatorio?: boolean;
};

export const ANAMNESE_TIPO_LABELS: Record<AnamneseCampoTipo, string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  sim_nao: 'Sim / Não',
  opcoes: 'Opções (lista)',
};
