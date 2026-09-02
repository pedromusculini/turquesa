import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { loadClientesStore } from '@/lib/clientesDrive';
import { buildAgendaUltimaSessaoPorCliente } from '@/lib/clientesCrmLastSessao';
import {
  CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  getClientesCrmSegmentoPage,
  type CrmSegmento,
} from '@/lib/clientesCrmSegments';
import { ensureClienteDriveArrays } from '@/lib/testProfileClientesCleanup';

const SEGMENTOS: CrmSegmento[] = [
  'sem_retorno',
  'aniversariantes',
  'sem_atendimento',
  'primeira_visita',
  'fidelizadas',
  'com_faltas',
  'top_clientes',
];

/** Lista paginada por segmento do relatório de clientes. */
export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const sp = req.nextUrl.searchParams;
  const segmento = sp.get('segmento') as CrmSegmento;
  if (!SEGMENTOS.includes(segmento)) {
    return NextResponse.json({ error: 'segmento inválido' }, { status: 400 });
  }

  const page = Math.max(Number(sp.get('page') || '1') || 1, 1);
  const limitRaw = Number(sp.get('limit') || '20') || 20;
  const limit = Math.min(Math.max(limitRaw, 1), CRM_SEM_RETORNO_PAGE_SIZE_MAX);
  const sortParam = sp.get('sort');
  const sort = sortParam === 'asc' ? 'asc' : 'desc';
  const dias = Number(sp.get('dias') || '');

  const store = await loadClientesStore(tokenResult, email);
  for (const c of store.clientes) {
    ensureClienteDriveArrays(c);
  }

  const agendaUltimaSessao = await buildAgendaUltimaSessaoPorCliente(email, store);

  const result = getClientesCrmSegmentoPage(store, segmento, {
    page,
    limit,
    sort,
    dias_limite: Number.isFinite(dias) && dias > 0 ? dias : undefined,
    agenda_ultima_sessao: agendaUltimaSessao,
  });

  return NextResponse.json({ segmento: result, storage: 'google_drive' });
}
