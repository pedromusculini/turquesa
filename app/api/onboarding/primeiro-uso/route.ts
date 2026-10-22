import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { loadOwnerSalonName } from '@/lib/salonDisplay';
import {
  ensureSlugPrimeiroUso,
  mensagemWhatsAppPrimeiroUso,
  parseServicosExtras,
  resolveServicosPrimeiroUso,
  seedHorariosPrimeiroUso,
  seedServicosPrimeiroUso,
} from '@/lib/primeiroUsoSalao';

export const runtime = 'nodejs';

/** Prepara catálogo, horários e link /agendar no primeiro uso. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.servicos)
    ? (body.servicos as unknown[]).map((id) => String(id))
    : [];
  const extras = parseServicosExtras(String(body.servicoExtra ?? ''));

  try {
    const nomeSalao = (await loadOwnerSalonName(email)) || 'nosso salão';
    const servicos = resolveServicosPrimeiroUso(ids);
    for (const nome of extras) {
      if (servicos.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) continue;
      servicos.push({ id: 'extra', nome, duracaoMinutos: 40, precoCentavos: 5000 });
    }

    const nomes = await seedServicosPrimeiroUso(email, servicos);
    if (nomes.length === 0) {
      throw new Error('Não conseguimos preparar os serviços do salão. Tente novamente.');
    }
    const horariosPreparados = await seedHorariosPrimeiroUso(email);
    if (!horariosPreparados) {
      throw new Error('Não conseguimos preparar os horários do salão. Tente novamente.');
    }
    const slug = await ensureSlugPrimeiroUso(email, nomeSalao);
    if (!slug?.url) {
      throw new Error('Não conseguimos criar o link de agendamento. Tente novamente.');
    }

    return NextResponse.json({
      ok: true,
      servicos: nomes,
      link_agendar: slug.url,
      slug: slug.slug,
      mensagem_whatsapp: mensagemWhatsAppPrimeiroUso(nomeSalao, slug.url),
    });
  } catch (err) {
    console.error('[onboarding/primeiro-uso]', err);
    const message =
      err instanceof Error && err.message.startsWith('Não conseguimos')
        ? err.message
        : 'Não conseguimos preparar seu primeiro uso. Tente novamente.';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
