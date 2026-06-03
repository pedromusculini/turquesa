/** Garante cadastro no Drive antes de agendar / atendimento (cliente). */
export async function ensurePacienteCliente(params: {
  nome: string;
  telefone?: string;
  cliente_id?: string | null;
  paciente_sel?: string;
}): Promise<{
  id: string;
  nome: string;
  telefone: string | null;
  convenio: string | null;
  criado: boolean;
}> {
  const res = await fetch('/api/clientes/resolve-paciente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Erro ao cadastrar paciente');
  return {
    id: d.cliente.id,
    nome: d.cliente.nome,
    telefone: d.cliente.telefone,
    convenio: d.cliente.convenio,
    criado: !!d.criado,
  };
}
