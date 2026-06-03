import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { resolveOrCreatePacienteCliente } from '@/lib/resolvePacienteCliente';
import { parsePacienteSel } from '@/lib/pacienteOpcoesUi';
import { aplicarMascaraWhatsapp } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();

  try {
    const sel = String(body.paciente_sel ?? '');
    const { driveId } = parsePacienteSel(sel);
    const hadDriveId = !!body.cliente_id || !!driveId;

    const cliente = await resolveOrCreatePacienteCliente(tokenResult, email, {
      nome: body.nome,
      telefone: body.telefone,
      cliente_id: body.cliente_id,
      paciente_sel: body.paciente_sel,
    });

    const { atendimentos, observacoes, pagamentos, ...resumo } = cliente;

    return NextResponse.json({
      cliente: {
        ...resumo,
        telefone: resumo.telefone ? aplicarMascaraWhatsapp(resumo.telefone) : null,
      },
      criado: !hadDriveId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar paciente';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
