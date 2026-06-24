import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  consultaBelongsToOwner,
  markLembreteEnviado,
  type LembreteTipo,
} from '@/lib/consultasAgenda';

type Params = { params: Promise<{ consultaId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { consultaId } = await params;

  const body = await req.json().catch(() => ({}));
  const tipo = body.tipo as LembreteTipo;
  if (tipo !== 'd7' && tipo !== 'd1') {
    return NextResponse.json({ error: 'tipo inválido (d7 ou d1)' }, { status: 400 });
  }

  const owned = await consultaBelongsToOwner(consultaId, email);
  if (!owned) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
  }

  await markLembreteEnviado({
    consultaId,
    ownerEmail: email,
    tipo,
  });

  return NextResponse.json({ ok: true });
}
