import { loadAnamneseCamposOwner } from '@/lib/anamnese';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import {
  allAtendimentosOrdenados,
  anamneseValuesFromDetalhe,
  enrichClienteDetalhe,
} from '@/lib/clienteFicha';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';
import { resolveGoogleSubByOwnerEmail } from '@/lib/publicAgendamentoCalendar';
import { loadOwnerSalonName } from '@/lib/salonDisplay';
import { supabaseAdmin } from '@/lib/supabaseClient';

export type ClienteFichaPublicAtendimento = {
  data: string;
  hora: string | null;
  servico: string | null;
  medico: string | null;
  observacoes: string | null;
  status: string;
};

export type ClienteFichaPublicData = {
  nome_salao: string;
  cliente: {
    nome: string;
    telefone: string | null;
    email: string | null;
    observacoes_gerais: string | null;
    servico_interesse_nome: string | null;
  };
  anamnese_campos: Awaited<ReturnType<typeof loadAnamneseCamposOwner>>;
  anamnese_respostas: Record<string, string | boolean>;
  observacoes: Array<{ texto: string; autor: string | null; created_at: string }>;
  ultimos_atendimentos: ClienteFichaPublicAtendimento[];
};

export async function loadClienteFichaByFormularioToken(
  token: string,
): Promise<
  | { ok: true; data: ClienteFichaPublicData }
  | { ok: false; status: number; error: string }
> {
  const { data: link, error } = await supabaseAdmin
    .from('formulario_links')
    .select('titulo, ativo, expires_at, cliente_drive_id, owner_email')
    .eq('token', token)
    .single();

  if (error || !link) {
    return { ok: false, status: 404, error: 'Link inválido ou expirado' };
  }

  if (!link.ativo) {
    return { ok: false, status: 410, error: 'Este link não está mais ativo' };
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { ok: false, status: 410, error: 'Link expirado' };
  }

  const clienteDriveId = String(link.cliente_drive_id ?? '').trim();
  if (!clienteDriveId) {
    return {
      ok: false,
      status: 400,
      error: 'Este link é de cadastro geral, não de ficha de cliente',
    };
  }

  const ownerEmail = String(link.owner_email ?? '').trim();
  const googleSub = await resolveGoogleSubByOwnerEmail(ownerEmail);
  if (!googleSub) {
    return { ok: false, status: 503, error: 'Integração Google indisponível' };
  }

  const driveToken = await getOwnerGoogleAccessToken(googleSub, 'drive');
  if (!driveToken) {
    return { ok: false, status: 503, error: 'Não foi possível acessar os dados do cliente' };
  }

  const store = await loadClientesStore(driveToken, ownerEmail);
  const cliente = findCliente(store, clienteDriveId);
  if (!cliente) {
    return { ok: false, status: 404, error: 'Cliente não encontrado' };
  }

  const [detalhe, anamneseCampos, nomeSalao] = await Promise.all([
    enrichClienteDetalhe(ownerEmail, cliente),
    loadAnamneseCamposOwner(ownerEmail),
    loadOwnerSalonName(ownerEmail),
  ]);

  const anamneseRespostas = anamneseValuesFromDetalhe(detalhe, anamneseCampos);
  const atendimentos = allAtendimentosOrdenados(detalhe).slice(0, 3);

  const observacoes = (detalhe.observacoes ?? [])
    .filter((o) => !o.texto.startsWith('[Anamnese —'))
    .map((o) => ({
      texto: o.texto,
      autor: o.autor,
      created_at: o.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    ok: true,
    data: {
      nome_salao: nomeSalao,
      cliente: {
        nome: detalhe.nome,
        telefone: detalhe.telefone,
        email: detalhe.email,
        observacoes_gerais: detalhe.observacoes_gerais,
        servico_interesse_nome: detalhe.servico_interesse_nome ?? null,
      },
      anamnese_campos: anamneseCampos,
      anamnese_respostas: anamneseRespostas,
      observacoes,
      ultimos_atendimentos: atendimentos.map((a) => ({
        data: a.data,
        hora: a.hora,
        servico: a.servico,
        medico: a.medico,
        observacoes: a.observacoes,
        status: a.status,
      })),
    },
  };
}
