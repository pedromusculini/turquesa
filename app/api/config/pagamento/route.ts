import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import {
  defaultConfigPagamento,
  type ConfigPagamentoMetodos,
  type MetodoPagamentoId,
} from '@/lib/configPagamento';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('config_pagamento_metodos, repassar_custo_profissional')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    const config = {
      ...defaultConfigPagamento(),
      ...((data?.config_pagamento_metodos as ConfigPagamentoMetodos) ?? {}),
    };

    return NextResponse.json({
      config,
      repassar_custo_profissional: !!data?.repassar_custo_profissional,
    });
  } catch (error) {
    console.error('[config/pagamento/GET]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar configuração') },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const configInput = body.config as ConfigPagamentoMetodos | undefined;
    const repassar = body.repassar_custo_profissional;

    const merged = { ...defaultConfigPagamento(), ...(configInput ?? {}) };

    // Sanitiza valores
    for (const key of Object.keys(merged) as MetodoPagamentoId[]) {
      const m = merged[key];
      if (!m) continue;
      if (m.tipo === 'fixo') {
        merged[key] = { tipo: 'fixo', valor_centavos: Math.max(0, Math.round(m.valor_centavos)) };
      } else {
        merged[key] = {
          tipo: 'percentual',
          percentual: Math.min(100, Math.max(0, Number(m.percentual) || 0)),
        };
      }
    }

    const { error } = await supabaseAdmin
      .from('onboarding_profiles')
      .update({
        config_pagamento_metodos: merged,
        repassar_custo_profissional: !!repassar,
      })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({
      config: merged,
      repassar_custo_profissional: !!repassar,
      message: 'Configuração salva',
    });
  } catch (error) {
    console.error('[config/pagamento/PUT]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao salvar configuração') },
      { status: 500 },
    );
  }
}
