import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { AGENDA_SNAPSHOT_PREFIX } from '@/lib/agendaDriveSnapshot';
import { listarArquivosMedSupApp } from '@/lib/googleDrive';

/** GET — status do snapshot diário da agenda no Drive. */
export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const files = await listarArquivosMedSupApp(tokenResult, {
    namePrefix: AGENDA_SNAPSHOT_PREFIX,
    mimeTypes: ['application/json', 'application/json;charset=utf-8'],
  });

  const latest = files[0] ?? null;

  return NextResponse.json({
    automatic_enabled: true,
    frequency: 'daily',
    retention_days: 30,
    latest,
    total_snapshots: files.length,
    note: 'Somente leitura no Drive — não altera Google Calendar nem exclusões na agenda.',
  });
}
