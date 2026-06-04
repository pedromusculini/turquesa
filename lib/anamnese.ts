import { supabaseAdmin } from '@/lib/supabaseClient';

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

const TIPOS: AnamneseCampoTipo[] = ['texto_curto', 'texto_longo', 'sim_nao', 'opcoes'];

export function sanitizeAnamneseCampoInput(raw: unknown, index: number): AnamneseCampoInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = String(o.label ?? '').trim();
  if (!label || label.length > 255) return null;
  const tipo = String(o.tipo ?? '') as AnamneseCampoTipo;
  if (!TIPOS.includes(tipo)) return null;
  const ordem = Number.isFinite(Number(o.ordem)) ? Number(o.ordem) : index;
  let opcoes: string[] = [];
  if (tipo === 'opcoes') {
    const src = Array.isArray(o.opcoes) ? o.opcoes : [];
    opcoes = src
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 20);
    if (opcoes.length < 2) return null;
  }
  return {
    id: o.id ? String(o.id) : undefined,
    ordem,
    label,
    tipo,
    opcoes,
    obrigatorio: !!o.obrigatorio,
  };
}

export function rowToAnamneseCampo(row: Record<string, unknown>): AnamneseCampo {
  const opcoesRaw = row.opcoes;
  const opcoes = Array.isArray(opcoesRaw)
    ? opcoesRaw.map((x) => String(x).trim()).filter(Boolean)
    : [];
  return {
    id: String(row.id),
    owner_email: String(row.owner_email),
    ordem: Number(row.ordem) || 0,
    label: String(row.label),
    tipo: row.tipo as AnamneseCampoTipo,
    opcoes,
    obrigatorio: !!row.obrigatorio,
  };
}

export function validateAnamneseRespostas(
  campos: AnamneseCampo[],
  respostas: Record<string, unknown>,
): string | null {
  for (const campo of campos) {
    const val = respostas[campo.id];
    const empty =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && !val.trim());
    if (campo.obrigatorio && empty) {
      return `Preencha o campo "${campo.label}"`;
    }
    if (campo.tipo === 'sim_nao' && val !== undefined && val !== null && val !== '') {
      if (val !== true && val !== false && val !== 'sim' && val !== 'nao') {
        return `Resposta inválida em "${campo.label}"`;
      }
    }
    if (campo.tipo === 'opcoes' && val !== undefined && val !== null && val !== '') {
      const s = String(val).trim();
      if (!campo.opcoes.includes(s)) {
        return `Opção inválida em "${campo.label}"`;
      }
    }
  }
  return null;
}

export function normalizeAnamneseRespostas(
  campos: AnamneseCampo[],
  respostas: Record<string, unknown>,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const campo of campos) {
    const val = respostas[campo.id];
    if (val === undefined || val === null || val === '') continue;
    if (campo.tipo === 'sim_nao') {
      if (val === true || val === 'sim') out[campo.id] = true;
      else if (val === false || val === 'nao') out[campo.id] = false;
      continue;
    }
    out[campo.id] = String(val).trim();
  }
  return out;
}

export async function loadAnamneseCamposOwner(ownerEmail: string): Promise<AnamneseCampo[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('anamnese_campos')
    .select('*')
    .eq('owner_email', owner)
    .order('ordem', { ascending: true });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => rowToAnamneseCampo(row as Record<string, unknown>));
}

export async function parseAnamneseFromBody(
  ownerEmail: string,
  body: Record<string, unknown>,
): Promise<{ campos: AnamneseCampo[]; respostas: Record<string, string | boolean> } | null> {
  const raw = body.anamnese_respostas;
  if (!raw || typeof raw !== 'object') return null;
  const campos = await loadAnamneseCamposOwner(ownerEmail);
  if (campos.length === 0) return null;
  const respostasRaw = raw as Record<string, unknown>;
  const err = validateAnamneseRespostas(campos, respostasRaw);
  if (err) throw new Error(err);
  return {
    campos,
    respostas: normalizeAnamneseRespostas(campos, respostasRaw),
  };
}

export function mergeAnamneseRespostas(
  existing: Record<string, string | boolean> | null | undefined,
  incoming: Record<string, string | boolean>,
): Record<string, string | boolean> {
  return { ...(existing ?? {}), ...incoming };
}

export const ANAMNESE_TIPO_LABELS: Record<AnamneseCampoTipo, string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  sim_nao: 'Sim / Não',
  opcoes: 'Opções (lista)',
};
