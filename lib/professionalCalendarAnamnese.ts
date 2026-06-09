import { appendAnamneseLinkToProfessionalDescription } from '@/lib/calendarInvite';
import { ensureClienteFormularioLink } from '@/lib/formularioLinks';
import { createShortRedirectUrl } from '@/lib/shortLink';

/** Enriquece descrição do evento Google da profissional com link curto da ficha do cliente. */
export async function enrichProfessionalCalendarDescription(params: {
  description: string;
  ownerEmail: string;
  clienteDriveId?: string | null;
  nomeCliente?: string | null;
}): Promise<string> {
  const clienteDriveId = params.clienteDriveId?.trim();
  if (!clienteDriveId) return params.description;

  try {
    const { link } = await ensureClienteFormularioLink({
      ownerEmail: params.ownerEmail,
      clienteDriveId,
      nomeCliente: params.nomeCliente?.trim() || undefined,
    });
    const anamneseUrl = createShortRedirectUrl(link) || link;
    return appendAnamneseLinkToProfessionalDescription(params.description, anamneseUrl);
  } catch (err) {
    console.warn('[professionalCalendarAnamnese]', err);
    return params.description;
  }
}
