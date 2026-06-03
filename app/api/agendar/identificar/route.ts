import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { findPacienteByTelefone, getOwnerBySlug, maskNome } from '@/lib/agendamento';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  const telefone = req.nextUrl.searchParams.get('telefone')?.trim();
  if (!slug || !telefone) {
    return NextResponse.json({ error: 'slug e telefone obrigatórios' }, { status: 400 });
  }

  const rl = checkRateLimit(`agendar-id:${slug}:${telefone.replace(/\D/g, '').slice(-4)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 });
  }

  const slugRow = await getOwnerBySlug(slug);
  if (!slugRow) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  }

  const paciente = await findPacienteByTelefone(slugRow.owner_email, telefone);
  if (!paciente) {
    return NextResponse.json({ encontrado: false });
  }

  return NextResponse.json({
    encontrado: true,
    nome_parcial: maskNome(paciente.nome),
    nome: paciente.nome,
    cliente_drive_id: paciente.cliente_drive_id,
    convenio: paciente.convenio,
  });
}
