import type { PacienteOpcao } from '@/lib/types';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { nomesMatch } from '@/lib/phoneMatch';

/** WhatsApp formatado a partir de uma opção (Drive ou Google Contatos). */
export function telefoneFromOpcao(opt: PacienteOpcao | null | undefined): string {
  if (!opt) return '';
  const raw = opt.telefone || opt.telefoneSugerido;
  if (!raw) return '';
  return aplicarMascaraWhatsapp(raw);
}

/** Busca telefone em entradas Google Contatos com nome compatível. */
export function findTelefoneGooglePorNome(
  nome: string | null | undefined,
  opcoes: PacienteOpcao[],
): string {
  if (!nome?.trim()) return '';
  for (const o of opcoes) {
    if (o.origem !== 'google') continue;
    if (!nomesMatch(o.nome, nome)) continue;
    const tel = telefoneFromOpcao(o);
    if (tel) return tel;
  }
  return '';
}

/** Indica se o campo já tem número utilizável (DDD + número). */
export function telefonePreenchido(tel: string | null | undefined): boolean {
  return (tel ?? '').replace(/\D/g, '').length >= 10;
}

export function parsePacienteSel(sel: string): { driveId: string | null; isGoogle: boolean } {
  if (!sel) return { driveId: null, isGoogle: false };
  if (sel.startsWith('d:')) return { driveId: sel.slice(2), isGoogle: false };
  if (sel.startsWith('g:')) return { driveId: null, isGoogle: true };
  return { driveId: null, isGoogle: false };
}

export function selFromDriveId(id: string | null | undefined): string {
  if (!id) return '';
  if (id.startsWith('d:') || id.startsWith('g:')) return id;
  return `d:${id}`;
}

function mergeOpcaoFields(prev: PacienteOpcao, o: PacienteOpcao): PacienteOpcao {
  const tel = prev.telefone || o.telefone;
  const sugerido = prev.telefoneSugerido || o.telefoneSugerido;
  return {
    ...prev,
    telefone: tel,
    telefoneSugerido: tel ? sugerido : sugerido || o.telefone || prev.telefoneSugerido,
    email: prev.email || o.email,
    cpf: prev.cpf || o.cpf,
    data_nascimento: prev.data_nascimento || o.data_nascimento,
    convenio: prev.convenio || o.convenio,
  };
}

/** Enriquece cadastros Drive sem telefone com WhatsApp do Google Contatos (mesmo nome). */
export function enrichOpcoesComGoogle(opcoes: PacienteOpcao[]): PacienteOpcao[] {
  const googleComTel = opcoes.filter(
    (o) => o.origem === 'google' && telefonePreenchido(o.telefone),
  );
  if (googleComTel.length === 0) return opcoes;

  const enrichedDriveIds = new Set<string>();

  const enriched = opcoes.map((o) => {
    if (o.origem !== 'drive' || telefonePreenchido(o.telefone)) return o;
    const g = googleComTel.find((gc) => nomesMatch(gc.nome, o.nome));
    if (!g?.telefone) return o;
    const tel = aplicarMascaraWhatsapp(g.telefone);
    enrichedDriveIds.add(o.id);
    return {
      ...o,
      telefone: tel,
      telefoneSugerido: tel,
      email: o.email || g.email,
      data_nascimento: o.data_nascimento || g.data_nascimento,
    };
  });

  if (enrichedDriveIds.size === 0) return enriched;

  return enriched.filter((o) => {
    if (o.origem !== 'google' || !telefonePreenchido(o.telefone)) return true;
    return !enriched.some(
      (d) =>
        d.origem === 'drive' &&
        enrichedDriveIds.has(d.id) &&
        nomesMatch(d.nome, o.nome),
    );
  });
}

export function mergeOpcoesLista(
  base: PacienteOpcao[],
  incoming: PacienteOpcao[],
): PacienteOpcao[] {
  const map = new Map<string, PacienteOpcao>();
  for (const o of base) map.set(o.id, o);
  for (const o of incoming) {
    const prev = map.get(o.id);
    if (!prev) {
      map.set(o.id, o);
      continue;
    }
    map.set(o.id, mergeOpcaoFields(prev, o));
  }
  return enrichOpcoesComGoogle(
    Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );
}

/** Busca WhatsApp no cadastro Drive quando a opção da lista veio sem telefone. */
export async function fetchTelefoneClienteDrive(selOrDriveId: string): Promise<string> {
  const { driveId } = parsePacienteSel(selFromDriveId(selOrDriveId));
  if (!driveId) return '';
  try {
    const res = await fetch(`/api/clientes/${encodeURIComponent(driveId)}`);
    if (!res.ok) return '';
    const data = (await res.json()) as { cliente?: { telefone?: string | null } };
    const raw = data.cliente?.telefone;
    return raw ? aplicarMascaraWhatsapp(raw) : '';
  } catch {
    return '';
  }
}

export function clientesApiToOpcoes(
  clientes: Array<{
    id: string;
    nome: string;
    telefone?: string | null;
    email?: string | null;
    cpf?: string | null;
    data_nascimento?: string | null;
    convenio?: string | null;
  }>,
): PacienteOpcao[] {
  return clientes.map((c) => ({
    id: `d:${c.id}`,
    nome: c.nome,
    telefone: c.telefone ? aplicarMascaraWhatsapp(c.telefone) : null,
    email: c.email ?? null,
    cpf: c.cpf ?? null,
    data_nascimento: c.data_nascimento ?? null,
    convenio: c.convenio ?? null,
    origem: 'drive' as const,
  }));
}
