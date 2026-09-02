import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { markResgateStatus } from '@/lib/resgatePendentes';

type Params = { params: Promise<{ clienteId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { clienteId } = await params;

  if (!clienteId?.trim()) {
    return NextResponse.json({ error: 'cliente inválido' }, { status: 400 });
  }

  await markResgateStatus(email, clienteId, 'enviado');
  return NextResponse.json({ ok: true });
}
