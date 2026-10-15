import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  SessaoMudouError,
  cancelarSessaoPelaVerificacao,
  reenviarSessaoAoGoogle,
  usarHorarioDoGoogle,
  verificarSessoesNoGoogle,
} from '@/lib/agendaGoogleVerificacao';
import { consultasAgendaErrorMessage } from '@/lib/consultasAgenda';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ACOES = ['reenviar', 'usar_google', 'cancelar'] as const;
type Acao = (typeof ACOES)[number];

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

/** Decisão do salão sobre uma divergência: reenviar ao Google, usar o horário do Google ou cancelar na Turquesa. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = (await req.json().catch(() => ({}))) as {
    consultaId?: unknown;
    acao?: unknown;
    inicio?: unknown;
    medico?: unknown;
  };
  const consultaId = typeof body.consultaId === 'string' ? body.consultaId.trim() : '';
  const acao = body.acao as Acao;
  const inicio = typeof body.inicio === 'string' ? body.inicio.trim() : '';
  const medico = typeof body.medico === 'string' ? body.medico : null;
  if (!consultaId || !inicio || !ACOES.includes(acao)) {
    return NextResponse.json(
      { error: 'Informe consultaId, inicio e acao (reenviar | usar_google | cancelar).' },
      { status: 400 },
    );
  }
  const esperada = { inicio, medico };

  try {
    if (acao === 'reenviar') {
      const result = await reenviarSessaoAoGoogle(email, consultaId, esperada);
      return NextResponse.json({ success: true, ...result });
    }
    if (acao === 'usar_google') {
      const result = await usarHorarioDoGoogle(email, consultaId, esperada);
      return NextResponse.json({ success: true, ...result });
    }
    await cancelarSessaoPelaVerificacao(email, consultaId, esperada);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SessaoMudouError) {
      return NextResponse.json({ error: error.message, mudou: true }, { status: 409 });
    }
    console.error('[agenda/google-verificacao] acao', acao, error);
    return NextResponse.json({ error: consultasAgendaErrorMessage(error) }, { status: 500 });
  }
}
