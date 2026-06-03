import { upsertConsultasAgenda } from '@/lib/consultasAgenda';
import { normalizeBrazilPhone } from '@/lib/whatsapp';

export function buildConsultaInicioBr(data: string, hora: string | null): string {
  const hh = hora && /^\d{1,2}:\d{2}/.test(hora) ? hora.slice(0, 5) : '09:00';
  const [h, m] = hh.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data}T${pad(h)}:${pad(m)}:00-03:00`;
}

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
      servico: 'Consulta',
      telefone: tel,
      inicio,
      fim: fimFromInicio(inicio),
      medico: params.medico ?? null,
      convenio: params.convenio ?? null,
      status: 'agendado',
      lembretes_whatsapp: params.lembretesWhatsapp !== false,
      cliente_drive_id: params.clienteDriveId ?? null,
    },
  ]);
}
