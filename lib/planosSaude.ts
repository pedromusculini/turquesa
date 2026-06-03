/**
 * Operadoras e convênios de saúde no Brasil.
 * Ordenação: maior base de beneficiários / penetração de mercado → menor (ANS 2025–2026).
 * Fontes: ANS, IESS NAB, rankings setoriais (Hapvida, Bradesco, Amil, SulAmérica, Unimed).
 */

export type PlanoSaudeOption = {
  id: string;
  label: string;
  /** Faixa de mercado aproximada para agrupamento visual */
  tier: 'lider' | 'grande' | 'medio' | 'regional' | 'outro';
};

/** Operadoras e sistemas — do mais ao menos utilizado no país */
export const PLANOS_SAUDE_OPERADORAS: PlanoSaudeOption[] = [
  { id: 'unimed', label: 'Unimed (rede nacional)', tier: 'lider' },
  { id: 'hapvida', label: 'Hapvida', tier: 'lider' },
  { id: 'notredame', label: 'NotreDame Intermédica', tier: 'lider' },
  { id: 'bradesco-saude', label: 'Bradesco Saúde', tier: 'lider' },
  { id: 'amil', label: 'Amil', tier: 'lider' },
  { id: 'sulamerica', label: 'SulAmérica Saúde', tier: 'lider' },
  { id: 'porto-seguro', label: 'Porto Seguro Saúde', tier: 'grande' },
  { id: 'prevent-senior', label: 'Prevent Senior', tier: 'grande' },
  { id: 'assim-saude', label: 'Assim Saúde', tier: 'grande' },
  { id: 'golden-cross', label: 'Golden Cross', tier: 'grande' },
  { id: 'omint', label: 'Omint', tier: 'grande' },
  { id: 'care-plus', label: 'Care Plus', tier: 'grande' },
  { id: 'medsenior', label: 'MedSenior', tier: 'grande' },
  { id: 'trasmontano', label: 'Trasmontano', tier: 'medio' },
  { id: 'sao-cristovao', label: 'São Cristóvão', tier: 'regional' },
  { id: 'santa-casa-saude', label: 'Santa Casa Saúde', tier: 'regional' },
  { id: 'geap', label: 'GEAP', tier: 'medio' },
  { id: 'cassi', label: 'CASSI', tier: 'medio' },
  { id: 'petrobras-saude', label: 'Petrobras Saúde', tier: 'medio' },
  { id: 'caixa-saude', label: 'Caixa Saúde', tier: 'medio' },
  { id: 'saude-itau', label: 'Saúde Itaú', tier: 'medio' },
  { id: 'alice', label: 'Alice', tier: 'medio' },
  { id: 'sami', label: 'Sami', tier: 'medio' },
  { id: 'blue', label: 'Blue Saúde', tier: 'medio' },
  { id: 'afresp', label: 'AFRESP', tier: 'regional' },
  { id: 'unihosp', label: 'Unihosp', tier: 'regional' },
  { id: 'sao-francisco', label: 'São Francisco Saúde', tier: 'regional' },
  { id: 'gndi', label: 'GNDI / Diagnósticos (rede)', tier: 'regional' },
  { id: 'select', label: 'Select Saúde', tier: 'regional' },
  { id: 'nossa-saude', label: 'Nossa Saúde', tier: 'regional' },
  { id: 'fundaffemg', label: 'Fundação Saúde (AFFEMG)', tier: 'regional' },
  { id: 'economus', label: 'Economus', tier: 'regional' },
  { id: 'planserv', label: 'Planserv (BA)', tier: 'regional' },
  { id: 'unimed-campinas', label: 'Unimed Campinas', tier: 'regional' },
  { id: 'unimed-bh', label: 'Unimed Belo Horizonte', tier: 'regional' },
  { id: 'unimed-curitiba', label: 'Unimed Curitiba', tier: 'regional' },
  { id: 'unimed-porto-alegre', label: 'Unimed Porto Alegre', tier: 'regional' },
  { id: 'unimed-recife', label: 'Unimed Recife', tier: 'regional' },
  { id: 'unimed-fortaleza', label: 'Unimed Fortaleza', tier: 'regional' },
  { id: 'unimed-goiania', label: 'Unimed Goiânia', tier: 'regional' },
];

export const PLANOS_SAUDE_ATENDIMENTO: PlanoSaudeOption[] = [
  { id: 'particular', label: 'Particular (sem convênio)', tier: 'outro' },
  { id: 'sus', label: 'SUS', tier: 'outro' },
  { id: 'outro', label: 'Outro convênio', tier: 'outro' },
];

/** Prefixo ao salvar convênio digitado manualmente */
export const OUTRO_CONVENIO_PREFIX = 'Outro: ';

export const PLANO_SAUDE_OUTRO = PLANOS_SAUDE_ATENDIMENTO.find((p) => p.id === 'outro')!;

export function isOutroConvenioSalvo(label: string): boolean {
  return (
    label === PLANO_SAUDE_OUTRO.label ||
    label.startsWith(OUTRO_CONVENIO_PREFIX)
  );
}

export function textoOutroConvenio(label: string): string {
  if (label.startsWith(OUTRO_CONVENIO_PREFIX)) {
    return label.slice(OUTRO_CONVENIO_PREFIX.length).trim();
  }
  return '';
}

export function formatarOutroConvenio(nome: string): string {
  const t = nome.trim();
  return t ? `${OUTRO_CONVENIO_PREFIX}${t}` : '';
}

/** Separa labels conhecidos e entradas "Outro: ..." */
export function parseSelecaoConvenios(value: string | null | undefined) {
  const labels = parsePlanosSaudeSalvos(value);
  const conhecidos = new Set(PLANOS_SAUDE_TODOS.map((p) => p.label));
  const padrao: string[] = [];
  const outros: string[] = [];

  for (const label of labels) {
    if (label.startsWith(OUTRO_CONVENIO_PREFIX)) {
      const t = textoOutroConvenio(label);
      if (t) outros.push(t);
    } else if (label === PLANO_SAUDE_OUTRO.label) {
      /* marcado sem nome ainda */
    } else if (!conhecidos.has(label)) {
      outros.push(label);
    } else {
      padrao.push(label);
    }
  }

  return { padrao, outros };
}

export const PLANOS_SAUDE_TODOS: PlanoSaudeOption[] = [
  ...PLANOS_SAUDE_OPERADORAS,
  ...PLANOS_SAUDE_ATENDIMENTO,
];

const labelById = new Map(PLANOS_SAUDE_TODOS.map((p) => [p.id, p.label]));

export function planoSaudeLabel(id: string): string {
  return labelById.get(id) ?? id;
}

/** Valor salvo no banco: ids separados por vírgula ou labels legados */
export function parsePlanosSaudeSalvos(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatPlanosSaudeParaSalvar(ids: string[]): string {
  return ids
    .map((id) => planoSaudeLabel(id))
    .filter(Boolean)
    .join(', ');
}

export function idsFromSalvos(value: string | null | undefined): string[] {
  const parts = parsePlanosSaudeSalvos(value);
  const ids: string[] = [];
  for (const part of parts) {
    const byId = PLANOS_SAUDE_TODOS.find((p) => p.id === part);
    if (byId) {
      ids.push(byId.id);
      continue;
    }
    const byLabel = PLANOS_SAUDE_TODOS.find(
      (p) => p.label.toLowerCase() === part.toLowerCase(),
    );
    if (byLabel) ids.push(byLabel.id);
    else ids.push(`custom:${part}`);
  }
  return ids;
}

export const TIER_LABEL: Record<PlanoSaudeOption['tier'], string> = {
  lider: 'Maiores do Brasil',
  grande: 'Grandes operadoras',
  medio: 'Operadoras médias',
  regional: 'Regionais e cooperativas locais',
  outro: 'Formas de atendimento',
};
