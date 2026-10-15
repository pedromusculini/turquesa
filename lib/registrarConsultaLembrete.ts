import { upsertConsultasAgenda } from '@/lib/consultasAgenda';
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import { buildConsultaInicioBr } from '@/lib/consultaInicioBr';

export { buildConsultaInicioBr };

function fimFromInicio(inicio: string, minutos = 40): string {
  const d = new Date(inicio);
  if (Number.isNaN(d.getTime())) return inicio;
  d.setMinutes(d.getMinutes() + minutos);
  return d.toISOString();
}

export async function registrarConsultaParaLembrete(params: {
  ownerEmail: string;
  consultaId: string;
  paciente: string;
  telefone: string;
  data: string;
  hora: string | null;
  medico?: string | null;
  convenio?: string | null;
  clienteDriveId?: string | null;
  lembretesWhatsapp?: boolean;
}): Promise<void> {
  const tel = normalizeBrazilPhone(params.telefone);
  if (!tel || tel.length < 12) return;

  const inicio = buildConsultaInicioBr(params.data, params.hora);
  const inicioMs = new Date(inicio).getTime();
  if (Number.isNaN(inicioMs) || inicioMs < Date.now() - 24 * 60 * 60 * 1000) return;

  await upsertConsultasAgenda(params.ownerEmail, [
    {
      id: params.consultaId,
      paciente: params.paciente.trim(),
      telefone: tel,
      inicio,
      fim: fimFromInicio(inicio),
      medico: params.medico ?? null,
      convenio: params.convenio ?? null,
      status: 'confirmado',
      lembretes_whatsapp: params.lembretesWhatsapp !== false,
      cliente_drive_id: params.clienteDriveId ?? null,
    },
  ]);
}
