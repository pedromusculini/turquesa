import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import { fetchAgendaConsultasForCliente } from '@/lib/clienteConsultaLinks';

/** Impede apagar cadastro no Drive se ainda há sessões na agenda (Supabase). */
export async function clienteTemConsultaNaAgenda(
  ownerEmail: string,
  cliente: ClienteDriveRecord,
  store?: ClientesDriveStore | null,
): Promise<boolean> {
  const consultas = await fetchAgendaConsultasForCliente(ownerEmail, cliente, store);
  return consultas.length > 0;
}
