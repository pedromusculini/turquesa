import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { loadClientesStore } from '@/lib/clientesDrive';
import { loadClientesCrmExternoContext } from '@/lib/clientesCrmLastSessao';
import { enrichClientesCrmStatsWithMarketing } from '@/lib/clientesCrmMarketing';
import { getClientesCrmStats } from '@/lib/clientesCrmStats';
import { ensureClienteDriveArrays } from '@/lib/testProfileClientesCleanup';

/** Resumo CRM — sem paginar lista de clientes. */
export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  for (const c of store.clientes) {
    ensureClienteDriveArrays(c);
  }

  const { agendaUltimaSessao, agendamentoFuturo } = await loadClientesCrmExternoContext(
    email,
    store,
  );

  const stats = getClientesCrmStats(store, new Date(), {
    agenda_ultima_sessao: agendaUltimaSessao,
    agendamento_futuro: agendamentoFuturo,
  });

  const statsComMarketing = await enrichClientesCrmStatsWithMarketing(email, stats, store);

  return NextResponse.json({
    stats: statsComMarketing,
    storage: 'google_drive',
  });
}
