import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAtivacaoResumo, ownersComSessao } from '@/lib/ativacaoSalao';
import { sendAtivacao48hEmail, sendTrialTerminandoEmail } from '@/lib/email';
import { TRIAL_DAYS } from '@/lib/asaasBillingPolicy';

export const runtime = 'nodejs';

const DAY_MS = 24 * 60 * 60 * 1000;
const DIAS_AVISO_FIM_TRIAL = 7;

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get('authorization')?.trim() === `Bearer ${secret}`;
}

/**
 * Janela de 24h em `trial_ends_at` — com o cron diário, cada salão cai nela uma única vez,
 * sem precisar de coluna "e-mail enviado".
 */
async function trialOwnersEndingBetween(fromDays: number, toDays: number): Promise<string[]> {
  const now = Date.now();
  const { data, error } = await supabaseAdmin
    .from('assinaturas')
    .select('owner_email')
    .eq('status', 'trial')
    .gte('trial_ends_at', new Date(now + fromDays * DAY_MS).toISOString())
    .lt('trial_ends_at', new Date(now + toDays * DAY_MS).toISOString())
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => String((r as { owner_email: string }).owner_email).toLowerCase().trim());
}

/** Vercel Cron diário: lembrete 48h sem sessão + aviso de fim de teste com resumo. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get('dry') === '1';

  try {
    // Trial começou há 48–72h ⇔ termina entre (TRIAL_DAYS − 3) e (TRIAL_DAYS − 2) dias.
    const recentes = await trialOwnersEndingBetween(TRIAL_DAYS - 3, TRIAL_DAYS - 2);
    const comSessao = await ownersComSessao(recentes);
    const semSessao = recentes.filter((e) => !comSessao.has(e));

    const terminando = await trialOwnersEndingBetween(
      DIAS_AVISO_FIM_TRIAL - 1,
      DIAS_AVISO_FIM_TRIAL,
    );

    const enviados = { ativacao48h: 0, trialTerminando: 0, erros: 0 };

    if (!dryRun) {
      for (const email of semSessao) {
        try {
          await sendAtivacao48hEmail(email);
          enviados.ativacao48h++;
        } catch (err) {
          enviados.erros++;
          console.error('[cron/ativacao-emails] 48h', email, err);
        }
      }
      for (const email of terminando) {
        try {
          const resumo = await getAtivacaoResumo(email);
          await sendTrialTerminandoEmail(email, {
            diasRestantes: DIAS_AVISO_FIM_TRIAL,
            sessoes: resumo.sessoes,
            peloLink: resumo.agendamentosPeloLink,
            entradas: resumo.entradas,
          });
          enviados.trialTerminando++;
        } catch (err) {
          enviados.erros++;
          console.error('[cron/ativacao-emails] trial terminando', email, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      candidatos: { ativacao48h: semSessao.length, trialTerminando: terminando.length },
      enviados,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro no cron de ativação';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
