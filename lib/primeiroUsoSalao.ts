import { supabaseAdmin } from '@/lib/supabaseClient';
import { generateSlugBase, getAgendarPublicUrl, getSlugByOwner } from '@/lib/agendamento';
import { buildAgendarWhatsAppMessage } from '@/lib/whatsapp';

export type ServicoPrimeiroUso = {
  id: string;
  nome: string;
  duracaoMinutos: number;
  precoCentavos: number;
};

export const SERVICOS_PRIMEIRO_USO: ServicoPrimeiroUso[] = [
  { id: 'corte', nome: 'Corte', duracaoMinutos: 40, precoCentavos: 5000 },
  { id: 'escova', nome: 'Escova', duracaoMinutos: 40, precoCentavos: 6000 },
  { id: 'coloracao', nome: 'Coloração', duracaoMinutos: 90, precoCentavos: 15000 },
  { id: 'manicure', nome: 'Manicure', duracaoMinutos: 40, precoCentavos: 4000 },
  { id: 'pedicure', nome: 'Pedicure', duracaoMinutos: 50, precoCentavos: 4500 },
  { id: 'barba', nome: 'Barba', duracaoMinutos: 30, precoCentavos: 3500 },
  { id: 'sobrancelha', nome: 'Sobrancelha', duracaoMinutos: 20, precoCentavos: 3000 },
  { id: 'maquiagem', nome: 'Maquiagem', duracaoMinutos: 60, precoCentavos: 12000 },
];

export const SERVICOS_PRIMEIRO_USO_PADRAO = ['corte', 'escova', 'manicure'] as const;

/** Ter–sáb no editor: 1=seg … 6=sáb. */
const DIAS_UTEIS = [1, 2, 3, 4, 5, 6];

export function resolveServicosPrimeiroUso(ids: string[]): ServicoPrimeiroUso[] {
  const wanted = new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean));
  const fromChips = SERVICOS_PRIMEIRO_USO.filter((s) => wanted.has(s.id));
  if (fromChips.length > 0) return fromChips;
  return SERVICOS_PRIMEIRO_USO.filter((s) =>
    (SERVICOS_PRIMEIRO_USO_PADRAO as readonly string[]).includes(s.id),
  );
}

export async function seedServicosPrimeiroUso(
  ownerEmail: string,
  servicos: ServicoPrimeiroUso[],
): Promise<string[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data: existing } = await supabaseAdmin
    .from('servicos_catalogo')
    .select('nome')
    .eq('owner_email', owner);

  const have = new Set(
    (existing ?? []).map((row) => String(row.nome ?? '').trim().toLowerCase()).filter(Boolean),
  );
  const created: string[] = [];

  for (const item of servicos) {
    if (have.has(item.nome.toLowerCase())) {
      created.push(item.nome);
      continue;
    }
    const { error } = await supabaseAdmin.from('servicos_catalogo').insert({
      owner_email: owner,
      nome: item.nome,
      tipo: 'servico',
      duracao_minutos: item.duracaoMinutos,
      preco_centavos: item.precoCentavos,
      descricao: null,
      estoque: null,
      ativo: true,
    });
    if (error) {
      console.warn('[primeiro-uso] serviço', item.nome, error.message);
      continue;
    }
    have.add(item.nome.toLowerCase());
    created.push(item.nome);
  }

  return created;
}

export async function seedHorariosPrimeiroUso(ownerEmail: string): Promise<boolean> {
  const owner = ownerEmail.toLowerCase().trim();
  const { count } = await supabaseAdmin
    .from('agenda_disponibilidade')
    .select('id', { count: 'exact', head: true })
    .eq('owner_email', owner);

  if ((count ?? 0) > 0) return false;

  const rows = DIAS_UTEIS.map((dia_semana) => ({
    owner_email: owner,
    medico_nome: null,
    dia_semana,
    hora_inicio: '09:00',
    hora_fim: '18:00',
    duracao_minutos: 40,
    ativo: true,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from('agenda_disponibilidade').insert(rows);
  if (error) {
    console.warn('[primeiro-uso] horários', error.message);
    return false;
  }
  return true;
}

export async function ensureSlugPrimeiroUso(
  ownerEmail: string,
  nomeExibicao: string,
): Promise<{ slug: string; url: string } | null> {
  const owner = ownerEmail.toLowerCase().trim();
  const existing = await getSlugByOwner(owner);
  if (existing?.slug) {
    return { slug: existing.slug as string, url: getAgendarPublicUrl(existing.slug as string) };
  }

  const slug = generateSlugBase(nomeExibicao || 'agendar');
  const { data, error } = await supabaseAdmin
    .from('agendamento_slugs')
    .upsert(
      {
        owner_email: owner,
        slug,
        nome_exibicao: nomeExibicao || 'Agendamento',
        ativo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_email' },
    )
    .select('slug')
    .single();

  if (error || !data?.slug) {
    console.warn('[primeiro-uso] slug', error?.message);
    return null;
  }
  return { slug: data.slug as string, url: getAgendarPublicUrl(data.slug as string) };
}

export function mensagemWhatsAppPrimeiroUso(nomeSalao: string, linkAgendar: string): string {
  return buildAgendarWhatsAppMessage({ nomeClinica: nomeSalao, linkAgendar });
}
