import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { loadClientesStore } from '@/lib/clientesDrive';
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

  return NextResponse.json({
    stats: getClientesCrmStats(store),
    storage: 'google_drive',
  });
}
