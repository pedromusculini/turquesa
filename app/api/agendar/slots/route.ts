import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { getOwnerBySlug } from '@/lib/agendamento';
import { brMaxBookingDateString } from '@/lib/publicAgendamentoCalendar';
import { listPublicSlots } from '@/lib/publicAgendamentoSlots';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  const data = req.nextUrl.searchParams.get('data')?.trim();
  const medico = req.nextUrl.searchParams.get('medico')?.trim() || null;

  if (!slug || !data) {
    return NextResponse.json({ error: 'slug e data obrigatórios' }, { status: 400 });
  }

  if (!medico) {
    return NextResponse.json({ error: 'Profissional obrigatório' }, { status: 400 });
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
    const result = await listPublicSlots({
      ownerEmail: slugRow.owner_email,
      medico,
      dateStr: data,
    });

    if (!result.ok) {
      const status =
        result.code === 'no_calendar' ? 403 : result.code === 'out_of_range' ? 400 : 400;
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          maxDate: brMaxBookingDateString(),
        },
        { status },
      );
    }

    return NextResponse.json({
      slots: result.slots,
      maxDate: brMaxBookingDateString(),
    });
  } catch (error) {
    console.error('[agendar/slots]', error);
    return NextResponse.json({ error: 'Erro ao buscar horários' }, { status: 500 });
  }
}
