import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { listConsultasLembretesManuais } from '@/lib/consultasAgenda';
import {
  formatConsultaDataHora,
  renderMensagemForOwner,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrls } from '@/lib/whatsapp';
import { getConsultaCalendarLink } from '@/lib/calendarToken';
import { enderecoVarsFromProfile, loadOwnerProfile } from '@/lib/agendamento';
import { getLembretesSettings } from '@/lib/lembretesSettings';
import { syncConsultasAgendaFromGoogleCalendars } from '@/lib/syncConsultasFromGoogleServer';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    try {
      await syncConsultasAgendaFromGoogleCalendars(email);
    } catch (syncErr) {
      console.warn('[lembretes/pendentes] sync Google:', syncErr);
    }

    const [settings, d7, d1] = await Promise.all([
      getLembretesSettings(email),
      listConsultasLembretesManuais(email, 'd7'),
      listConsultasLembretesManuais(email, 'd1'),
    ]);

    const profile = await loadOwnerProfile(email);

    const clinica =
      String(profile?.clinic_name ?? profile?.full_name ?? '').trim() || 'seu salão';
    const { local: localPerfil, link_maps } = enderecoVarsFromProfile(profile);

    async function enrich(
      list: typeof d7,
      tipo: 'lembrete_7_dias' | 'lembrete_1_dia',
    ) {
      return Promise.all(
        list.map(async (c) => {
          const { data, hora } = formatConsultaDataHora(c.inicio);
          const linkCal = await getConsultaCalendarLink({
            consultaId: c.id,
            ownerEmail: email,
          });
          const mensagem = await renderMensagemForOwner(email, tipo, {
            nome: c.paciente,
            data,
            hora,
            medico: c.medico || '',
            local: c.local || localPerfil,
            clinica,
            link_calendario: linkCal,
            link_maps,
          });
          const urls = c.telefone ? buildWhatsAppUrls(c.telefone, mensagem) : null;
          return {
            ...c,
            data,
            hora,
            mensagem,
            whatsapp_url: urls?.web ?? null,
            whatsapp_app_url: urls?.app ?? null,
            whatsapp_android_url: urls?.android ?? null,
          };
        }),
      );
    }

    const lembretes7 = await enrich(d7, 'lembrete_7_dias');
    const lembretes1 = await enrich(d1, 'lembrete_1_dia');

    return NextResponse.json({ lembretes7, lembretes1, settings });
  } catch (error) {
    console.error('[lembretes/pendentes]', error);
    return NextResponse.json({ error: 'Erro ao listar lembretes' }, { status: 500 });
  }
}
