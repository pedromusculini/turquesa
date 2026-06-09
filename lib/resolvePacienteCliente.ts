import {
  createClienteRecord,
  findCliente,
  findClienteByContato,
  loadClientesStore,
  saveClientesStore,
  type ClienteDriveRecord,
} from '@/lib/clientesDrive';
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import { formatarTelefoneBr, phoneDigits } from '@/lib/phoneMatch';
import { parsePacienteSel } from '@/lib/pacienteOpcoesUi';

export type ResolvePacienteInput = {
  nome: string;
  telefone?: string | null;
  cliente_id?: string | null;
  paciente_sel?: string | null;
};

export async function resolveOrCreatePacienteCliente(
  accessToken: string,
  ownerEmail: string,
  input: ResolvePacienteInput,
): Promise<ClienteDriveRecord> {
  const store = await loadClientesStore(accessToken, ownerEmail);
  const nome = String(input.nome ?? '').trim();
  const telefoneNorm = input.telefone?.trim()
    ? normalizeBrazilPhone(input.telefone)
    : '';

  let clienteId = input.cliente_id?.trim() || null;
  if (!clienteId && input.paciente_sel) {
    const { driveId } = parsePacienteSel(input.paciente_sel);
    if (driveId) clienteId = driveId;
  }

  const telefoneDrive =
    telefoneNorm && phoneDigits(telefoneNorm).length >= 10
      ? formatarTelefoneBr(telefoneNorm)
      : null;

  if (clienteId) {
    const existente = findCliente(store, clienteId);
    if (!existente) throw new Error('Cliente não encontrado');
    if (telefoneDrive) existente.telefone = telefoneDrive;
    if (nome.length >= 2 && existente.nome !== nome) existente.nome = nome;
    existente.updated_at = new Date().toISOString();
    await saveClientesStore(accessToken, store);
    return existente;
  }

  if (telefoneNorm && phoneDigits(telefoneNorm).length >= 10) {
    const porTel = findClienteByContato(store, { telefone: telefoneNorm });
    if (porTel) {
      if (telefoneDrive) porTel.telefone = telefoneDrive;
      if (nome.length >= 2) porTel.nome = nome;
      porTel.updated_at = new Date().toISOString();
      await saveClientesStore(accessToken, store);
      return porTel;
    }
  }

  if (nome.length < 2) {
    throw new Error('Informe o nome do cliente (mín. 2 caracteres)');
  }

  const novo = createClienteRecord({
    nome,
    telefone: telefoneDrive,
    observacoes_gerais: '[Cadastro automático — agenda / sessão]',
  });
  store.clientes.push(novo);
  await saveClientesStore(accessToken, store);
  return novo;
}
