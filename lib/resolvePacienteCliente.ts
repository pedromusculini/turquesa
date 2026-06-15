import {
  createClienteRecord,
  findCliente,
  findExistingClienteByPhoneOrEmail,
  loadClientesStore,
  saveClientesStore,
  type ClienteDriveRecord,
} from '@/lib/clientesDrive';
import { upsertPacienteIndex } from '@/lib/agendamento';
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import { formatarTelefoneBr, phoneDigits } from '@/lib/phoneMatch';
import { parsePacienteSel } from '@/lib/pacienteOpcoesUi';

export type ResolvePacienteInput = {
  nome: string;
  telefone?: string | null;
  email?: string | null;
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
    const { driveId, isGoogle } = parsePacienteSel(input.paciente_sel);
    if (isGoogle) {
      throw new Error(
        'Contatos Google são apenas para consulta. Cadastre o cliente no sistema antes de agendar ou lançar atendimento.',
      );
    }
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
    if (existente.telefone) {
      try {
        await upsertPacienteIndex({
          ownerEmail,
          telefone: existente.telefone,
          nome: existente.nome,
          clienteDriveId: existente.id,
        });
      } catch {
        /* índice opcional */
      }
    }
    return existente;
  }

  const existente = findExistingClienteByPhoneOrEmail(store, {
    telefone: telefoneNorm || input.telefone,
    email: input.email,
    nome,
  });
  if (existente) {
    if (telefoneDrive) existente.telefone = telefoneDrive;
    if (nome.length >= 2) existente.nome = nome;
    if (input.email?.trim() && !existente.email) {
      existente.email = input.email.trim();
    }
    existente.updated_at = new Date().toISOString();
    await saveClientesStore(accessToken, store);
    if (existente.telefone) {
      try {
        await upsertPacienteIndex({
          ownerEmail,
          telefone: existente.telefone,
          nome: existente.nome,
          clienteDriveId: existente.id,
        });
      } catch {
        /* índice opcional */
      }
    }
    return existente;
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

  if (novo.telefone) {
    try {
      await upsertPacienteIndex({
        ownerEmail,
        telefone: novo.telefone,
        nome: novo.nome,
        clienteDriveId: novo.id,
      });
    } catch {
      /* índice opcional */
    }
  }

  return novo;
}
