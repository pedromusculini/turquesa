import { appendAnamneseLinkToProfessionalDescription } from '@/lib/calendarInvite';
import { ensureClienteFormularioLink } from '@/lib/formularioLinks';
import { buildClienteFichaProfissionalUrl } from '@/lib/publicFormLinks';
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
    const { token } = await ensureClienteFormularioLink({
      ownerEmail: params.ownerEmail,
      clienteDriveId,
      nomeCliente: params.nomeCliente?.trim() || undefined,
    });
    const fichaUrl = buildClienteFichaProfissionalUrl(token);
    const anamneseUrl = createShortRedirectUrl(fichaUrl) || fichaUrl;
    return appendAnamneseLinkToProfessionalDescription(params.description, anamneseUrl);
  } catch (err) {
    console.warn('[professionalCalendarAnamnese]', err);
    return params.description;
  }
}
