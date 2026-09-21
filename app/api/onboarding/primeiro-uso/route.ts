import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { loadOwnerSalonName } from '@/lib/salonDisplay';
import {
  ensureSlugPrimeiroUso,
  mensagemWhatsAppPrimeiroUso,
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
  const extraNome = String(body.servicoExtra ?? '').trim();

  try {
    const nomeSalao = (await loadOwnerSalonName(email)) || 'nosso salão';
    const servicos = resolveServicosPrimeiroUso(ids);
    if (extraNome && !servicos.some((s) => s.nome.toLowerCase() === extraNome.toLowerCase())) {
      servicos.push({
        id: 'extra',
        nome: extraNome.slice(0, 60),
        duracaoMinutos: 40,
        precoCentavos: 5000,
      });
    }

    const nomes = await seedServicosPrimeiroUso(email, servicos);
    await seedHorariosPrimeiroUso(email);
    const slug = await ensureSlugPrimeiroUso(email, nomeSalao);

    return NextResponse.json({
      ok: true,
      servicos: nomes,
      link_agendar: slug?.url ?? null,
      slug: slug?.slug ?? null,
      mensagem_whatsapp: slug?.url ? mensagemWhatsAppPrimeiroUso(nomeSalao, slug.url) : null,
    });
  } catch (err) {
    console.error('[onboarding/primeiro-uso]', err);
    return NextResponse.json(
      { error: 'Não foi possível preparar o primeiro uso. Você pode configurar no painel.' },
      { status: 500 },
    );
  }
}
