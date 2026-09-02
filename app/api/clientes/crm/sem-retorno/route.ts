import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { loadClientesStore } from '@/lib/clientesDrive';
import {
  CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  getClientesSemRetornoPage,
  type SemRetornoSort,
} from '@/lib/clientesCrmStats';
import { ensureClienteDriveArrays } from '@/lib/testProfileClientesCleanup';

/** Lista paginada de clientes sem retorno (60+ dias desde última sessão realizada). */
export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(Number(sp.get('page') || '1') || 1, 1);
  const limitRaw = Number(sp.get('limit') || '20') || 20;
  const limit = Math.min(Math.max(limitRaw, 1), CRM_SEM_RETORNO_PAGE_SIZE_MAX);
  const sortParam = sp.get('sort');
  const sort: SemRetornoSort = sortParam === 'asc' ? 'asc' : 'desc';
  const diasParam = Number(sp.get('dias') || '');

  const store = await loadClientesStore(tokenResult, email);
  for (const c of store.clientes) {
    ensureClienteDriveArrays(c);
  }

  return NextResponse.json({
    sem_retorno: getClientesSemRetornoPage(store, {
      page,
      limit,
      sort,
      dias_limite: Number.isFinite(diasParam) && diasParam > 0 ? diasParam : undefined,
    }),
    storage: 'google_drive',
  });
}
