import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
import { invalidateClientesDriveCache } from '@/lib/clientesDriveCache';
import {
  buildMergePreview,
  findDuplicatePairs,
  isMergeClientesEnabled,
  mergeClienteIntoPrimary,
  repointMergedClienteRefs,
  validateMergePair,
} from '@/lib/clientesUnificar';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';

function forbidden() {
  return NextResponse.json({ error: 'Recurso não disponível para esta conta.' }, { status: 403 });
}

function cloneStore<T>(store: T): T {
  return JSON.parse(JSON.stringify(store)) as T;
}

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  if (!isMergeClientesEnabled(email)) return forbidden();

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email, { force: true });
  const sugestoes = findDuplicatePairs(store);

  const primaryId = new URL(req.url).searchParams.get('primaryId')?.trim();
  const secondaryId = new URL(req.url).searchParams.get('secondaryId')?.trim();
  let preview = null;
  let previewError: string | null = null;

  if (primaryId && secondaryId) {
    previewError = validateMergePair(store, primaryId, secondaryId);
    if (!previewError) {
      preview = buildMergePreview(store, primaryId, secondaryId);
      if (!preview) {
        previewError = 'Cliente não encontrado. Atualize a página e tente novamente.';
      }
    }
  }

  return NextResponse.json({ sugestoes, preview, previewError, enabled: true });
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

  const store = await loadClientesStore(tokenResult, email, { force: true });
  const validationError = validateMergePair(store, primaryId, secondaryId);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const resolvedPrimaryId = resolveMergedPrimaryId(store, primaryId);
  const resolvedSecondaryId = resolveMergedPrimaryId(store, secondaryId);

  const preview = buildMergePreview(store, primaryId, secondaryId);
  if (!preview) {
    return NextResponse.json(
      { error: 'Cliente não encontrado. Atualize a página e tente novamente.' },
      { status: 404 },
    );
  }

  const workingStore = cloneStore(store);

  try {
    await repointMergedClienteRefs(email, resolvedPrimaryId, resolvedSecondaryId);

    const merged = mergeClienteIntoPrimary(workingStore, resolvedPrimaryId, resolvedSecondaryId);
    await saveClientesStore(tokenResult, workingStore);

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
    invalidateClientesDriveCache(email);
    const message =
      err instanceof Error ? err.message : 'Erro ao unificar clientes. Tente novamente.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
