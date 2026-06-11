import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { requireFinanceiroUnlocked } from '@/lib/financeiroPin';
import {
  percentualProfissionalPadrao,
  ultimoPercentualProfissional,
} from '@/lib/registrarEntradaFinanceira';

/** GET /api/financeiro/percentual-profissional?medico=Nome */
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const pinGuard = await requireFinanceiroUnlocked(email, req);
  if (pinGuard) return pinGuard;

  const medico = new URL(req.url).searchParams.get('medico')?.trim();
  if (!medico) {
    return NextResponse.json({ error: 'Parâmetro profissional obrigatório' }, { status: 400 });
  }

  const ultimo = await ultimoPercentualProfissional(email, medico);
  const padrao = await percentualProfissionalPadrao(email, medico);

  return NextResponse.json({
    medico,
    percentual: ultimo ?? padrao,
    fonte: ultimo != null ? 'ultimo_uso' : 'perfil',
  });
}
