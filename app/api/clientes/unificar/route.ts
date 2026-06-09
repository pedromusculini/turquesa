import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
import {
  buildMergePreview,
  findDuplicatePairs,
  isMergeClientesEnabled,
  mergeClienteIntoPrimary,
  repointMergedClienteRefs,
} from '@/lib/clientesUnificar';

function forbidden() {
  return NextResponse.json({ error: 'Recurso não disponível para esta conta.' }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  if (!isMergeClientesEnabled(email)) return forbidden();

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const sugestoes = findDuplicatePairs(store);

  const primaryId = new URL(req.url).searchParams.get('primaryId')?.trim();
  const secondaryId = new URL(req.url).searchParams.get('secondaryId')?.trim();
  const preview =
    primaryId && secondaryId ? buildMergePreview(store, primaryId, secondaryId) : null;

  return NextResponse.json({ sugestoes, preview, enabled: true });
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  if (!isMergeClientesEnabled(email)) return forbidden();

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  const primaryId = String(body.primaryId ?? '').trim();
  const secondaryId = String(body.secondaryId ?? '').trim();

  if (!primaryId || !secondaryId) {
    return NextResponse.json(
      { error: 'Informe primaryId (manter) e secondaryId (mesclar).' },
      { status: 400 },
    );
  }

  const store = await loadClientesStore(tokenResult, email);

  try {
    const preview = buildMergePreview(store, primaryId, secondaryId);
    if (!preview) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const merged = mergeClienteIntoPrimary(store, primaryId, secondaryId);
    await saveClientesStore(tokenResult, store);
    await repointMergedClienteRefs(email, primaryId, secondaryId);

    return NextResponse.json({
      success: true,
      cliente: {
        id: merged.id,
        nome: merged.nome,
        telefone: merged.telefone,
        atendimentos: merged.atendimentos.length,
      },
      preview,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao unificar clientes';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
