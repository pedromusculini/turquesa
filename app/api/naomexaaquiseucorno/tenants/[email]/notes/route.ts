import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import {
  addInternalTenantNote,
  listInternalTenantNotes,
} from '@/lib/internalTenantNotes';

type RouteContext = { params: Promise<{ email: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;

  const { email: raw } = await context.params;
  const ownerEmail = decodeURIComponent(raw).toLowerCase().trim();

  try {
    const notes = await listInternalTenantNotes(ownerEmail);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('[internal/notes GET]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const { email: raw } = await context.params;
  const ownerEmail = decodeURIComponent(raw).toLowerCase().trim();

  try {
    const body = await req.json();
    const text = String(body?.body ?? '').trim();
    if (!text) {
      return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 });
    }

    const note = await addInternalTenantNote({
      ownerEmail,
      adminEmail,
      body: text,
    });

    await logInternalAudit({
      adminEmail,
      action: 'add_internal_note',
      productId,
      targetOwnerEmail: ownerEmail,
      metadata: { note_id: note.id },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('[internal/notes POST]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
