import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { loadClientesStore } from '@/lib/clientesDrive';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  buildLegacyServicoCatalog,
  legacyCatalogToPayload,
} from '@/lib/legacyProcedimentoCatalog';
import { loadLegacyServicoCatalogForOwner } from '@/lib/legacyProcedimentoCatalogServer';

/** Catálogo de procedimentos legacy (conta com import CSV). */
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  let catalog = await loadLegacyServicoCatalogForOwner(email);
  if (!catalog) {
    return NextResponse.json({ legacy: false, servicos: [], clienteNomes: [] });
  }

  const driveClientes: string[] = [];
  const tokenResult = await requireGoogleAccessToken(req);
  if (!isDriveError(tokenResult)) {
    try {
      const store = await loadClientesStore(tokenResult, email);
      for (const c of store.clientes) {
        if (c.nome?.trim()) driveClientes.push(c.nome.trim());
      }
    } catch {
      /* Drive offline */
    }
  }

  if (driveClientes.length > 0) {
    const base = legacyCatalogToPayload(catalog);
    catalog = buildLegacyServicoCatalog({
      catalogoServicos: base.servicos,
      clienteNomes: [...base.clienteNomes, ...driveClientes],
      financeiroDescricoes: [],
    });
  }

  return NextResponse.json({
    legacy: true,
    ...legacyCatalogToPayload(catalog),
  });
}
