import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { getOwnerBySlug, listSlots } from '@/lib/agendamento';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  const data = req.nextUrl.searchParams.get('data')?.trim();
  const medico = req.nextUrl.searchParams.get('medico')?.trim() || null;

  if (!slug || !data) {
    return NextResponse.json({ error: 'slug e data obrigatórios' }, { status: 400 });
  }

  const rl = checkRateLimit(`agendar-slots:${slug}:${data}`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 });
  }

  const slugRow = await getOwnerBySlug(slug);
  if (!slugRow) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  }

  try {
    const slots = await listSlots({
      ownerEmail: slugRow.owner_email,
      medico,
      dateStr: data,
    });
    return NextResponse.json({ slots });
  } catch (error) {
    console.error('[agendar/slots]', error);
    return NextResponse.json({ error: 'Erro ao buscar horários' }, { status: 500 });
  }
}
