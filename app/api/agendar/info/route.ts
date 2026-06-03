import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { getOwnerBySlug, resolvePacienteToken } from '@/lib/agendamento';
import { loadMedicosPublicos } from '@/lib/medicosPublicos';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 });
  }

  const rl = checkRateLimit(`agendar-info:${slug}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 });
  }

  const slugRow = await getOwnerBySlug(slug);
  if (!slugRow) {
    return NextResponse.json({ error: 'Link de agendamento não encontrado' }, { status: 404 });
  }

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('user_type, clinic_name, full_name, health_plan')
    .eq('email', slugRow.owner_email)
    .maybeSingle();

  const { isClinica, medicos } = await loadMedicosPublicos(slugRow.owner_email);

  const pToken = req.nextUrl.searchParams.get('p')?.trim();
  let pacientePessoal: {
    nome: string;
    cliente_drive_id: string;
    telefone: string;
  } | null = null;
  if (pToken) {
    const tok = await resolvePacienteToken(pToken);
    if (tok && tok.owner_email === slugRow.owner_email) {
      const { data: idx } = await supabaseAdmin
        .from('pacientes_index')
        .select('nome, telefone_normalizado')
        .eq('owner_email', slugRow.owner_email)
        .eq('cliente_drive_id', tok.cliente_drive_id)
        .maybeSingle();
      pacientePessoal = {
        nome: idx?.nome || 'Paciente',
        cliente_drive_id: tok.cliente_drive_id,
        telefone: idx?.telefone_normalizado || '',
      };
    }
  }

  return NextResponse.json({
    nome_exibicao: slugRow.nome_exibicao,
    user_type: profile?.user_type || 'medico',
    is_clinica: isClinica,
    medicos,
    paciente_pessoal: pacientePessoal,
  });
}
