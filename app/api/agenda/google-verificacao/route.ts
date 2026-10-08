import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  cancelarSessaoPelaVerificacao,
  reenviarSessaoAoGoogle,
  verificarSessoesNoGoogle,
} from '@/lib/agendaGoogleVerificacao';
import { consultasAgendaErrorMessage } from '@/lib/consultasAgenda';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Lista sessões futuras da Turquesa que não estão (ativas / no horário) no Google. */
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const diasParam = Number(new URL(req.url).searchParams.get('dias'));
  try {
    const result = await verificarSessoesNoGoogle(email, {
      dias: Number.isFinite(diasParam) && diasParam > 0 ? diasParam : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[agenda/google-verificacao]', error);
    return NextResponse.json({ error: consultasAgendaErrorMessage(error) }, { status: 500 });
  }
}

/** Decisão do salão sobre uma divergência: reenviar ao Google ou cancelar na Turquesa. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = (await req.json().catch(() => ({}))) as { consultaId?: unknown; acao?: unknown };
  const consultaId = typeof body.consultaId === 'string' ? body.consultaId.trim() : '';
  const acao = body.acao;
  if (!consultaId || (acao !== 'reenviar' && acao !== 'cancelar')) {
    return NextResponse.json(
      { error: 'Informe consultaId e acao (reenviar | cancelar).' },
      { status: 400 },
    );
  }

  try {
    if (acao === 'reenviar') {
      const result = await reenviarSessaoAoGoogle(email, consultaId);
      return NextResponse.json({ success: true, ...result });
    }
    await cancelarSessaoPelaVerificacao(email, consultaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[agenda/google-verificacao] acao', acao, error);
    return NextResponse.json({ error: consultasAgendaErrorMessage(error) }, { status: 500 });
  }
}
