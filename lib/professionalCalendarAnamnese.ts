import {
  appendAnamneseLinkToProfessionalDescription,
  stripAnamneseLineFromDescription,
} from '@/lib/calendarInvite';
import { ensureClienteFormularioLink } from '@/lib/formularioLinks';
import { buildClienteFichaProfissionalUrl } from '@/lib/publicFormLinks';
import { createShortRedirectUrl } from '@/lib/shortLink';

export type ProfessionalCalendarEnrichment = {
  description: string;
  anamneseUrl?: string;
};

/** Normaliza descrição + location da profissional (anamnese clicável via campo location). */
export async function enrichProfessionalCalendarEvent(params: {
  description: string;
  ownerEmail: string;
  clienteDriveId?: string | null;
  nomeCliente?: string | null;
}): Promise<ProfessionalCalendarEnrichment> {
  const baseDescription = stripAnamneseLineFromDescription(params.description || '');

  const clienteDriveId = params.clienteDriveId?.trim();
  if (!clienteDriveId) {
    return { description: baseDescription };
  }

  try {
    const { token } = await ensureClienteFormularioLink({
      ownerEmail: params.ownerEmail,
      clienteDriveId,
      nomeCliente: params.nomeCliente?.trim() || undefined,
    });
    const fichaUrl = buildClienteFichaProfissionalUrl(token);
    const anamneseUrl = createShortRedirectUrl(fichaUrl) || fichaUrl;
    return {
      description: appendAnamneseLinkToProfessionalDescription(baseDescription, anamneseUrl),
      anamneseUrl,
    };
  } catch (err) {
    console.warn('[professionalCalendarAnamnese]', err);
    return { description: baseDescription };
  }
}

/** @deprecated Use enrichProfessionalCalendarEvent */
export async function enrichProfessionalCalendarDescription(params: {
  description: string;
  ownerEmail: string;
  clienteDriveId?: string | null;
  nomeCliente?: string | null;
}): Promise<string> {
  const enriched = await enrichProfessionalCalendarEvent(params);
  return enriched.description;
}
