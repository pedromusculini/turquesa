import { supabaseAdmin } from '@/lib/supabaseClient';
import { generateSlugBase, getAgendarPublicUrl, getSlugByOwner } from '@/lib/agendamento';
import { buildAgendarWhatsAppMessage } from '@/lib/whatsapp';

import { resolveServicosPrimeiroUso, type ServicoPrimeiroUso } from '@/lib/primeiroUsoServicos';

export * from '@/lib/primeiroUsoServicos';

/** Ter–sáb no editor: 1=seg … 6=sáb. */
const DIAS_UTEIS = [1, 2, 3, 4, 5, 6];

export async function seedServicosPrimeiroUso(
  ownerEmail: string,
  servicos: ServicoPrimeiroUso[],
): Promise<string[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('servicos_catalogo')
    .select('nome')
    .eq('owner_email', owner);
  if (existingError) {
    console.warn('[primeiro-uso] consultar serviços', existingError.message);
    throw new Error('Não conseguimos conferir o catálogo do salão. Tente novamente.');
  }

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
      throw new Error('Não conseguimos preparar os serviços do salão. Tente novamente.');
    }
    have.add(item.nome.toLowerCase());
    created.push(item.nome);
  }

  return created;
}

export async function seedHorariosPrimeiroUso(ownerEmail: string): Promise<boolean> {
  const owner = ownerEmail.toLowerCase().trim();
  const { count, error: countError } = await supabaseAdmin
    .from('agenda_disponibilidade')
    .select('id', { count: 'exact', head: true })
    .eq('owner_email', owner);
  if (countError) {
    console.warn('[primeiro-uso] consultar horários', countError.message);
    throw new Error('Não conseguimos conferir os horários do salão. Tente novamente.');
  }

  if ((count ?? 0) > 0) return true;

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
    throw new Error('Não conseguimos preparar os horários do salão. Tente novamente.');
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
    throw new Error('Não conseguimos criar o link de agendamento. Tente novamente.');
  }
  return { slug: data.slug as string, url: getAgendarPublicUrl(data.slug as string) };
}

export function mensagemWhatsAppPrimeiroUso(nomeSalao: string, linkAgendar: string): string {
  return buildAgendarWhatsAppMessage({ nomeClinica: nomeSalao, linkAgendar });
}
