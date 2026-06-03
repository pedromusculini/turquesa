import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  supabaseErrorMessage,
  supabaseErrorStatus,
  isSupabaseNetworkError,
  isSupabaseMissingColumnError,
} from '@/lib/supabaseErrors';
import { isDevBypassAuthActive } from '@/lib/devBypassAuth';
import {
  devConfigPagamentoGet,
  devConfigPagamentoSet,
} from '@/lib/devConfigPagamentoStore';
import {
  defaultConfigPagamento,
  sanitizeConfigPagamento,
  type ConfigPagamentoMetodos,
  METODOS_PAGAMENTO_IDS,
} from '@/lib/configPagamento';

function devFallbackResponse(email: string) {
  const cached = devConfigPagamentoGet(email);
  return NextResponse.json({
    config: cached?.config ?? defaultConfigPagamento(),
    repassar_custo_profissional: cached?.repassar ?? false,
    devFallback: true,
  });
}

function normalizeConfig(merged: ConfigPagamentoMetodos): ConfigPagamentoMetodos {
  for (const key of METODOS_PAGAMENTO_IDS) {
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
  return sanitizeConfigPagamento(merged);
}

export async function GET() {
  let email: string | undefined;
  try {
    const authResult = await requireVerifiedOwner();
    if (isAuthError(authResult)) return authResult;
    email = authResult.email;

    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('config_pagamento_metodos, repassar_custo_profissional')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    const config = sanitizeConfigPagamento(
      data?.config_pagamento_metodos as ConfigPagamentoMetodos | undefined,
    );

    return NextResponse.json({
      config,
      repassar_custo_profissional: !!data?.repassar_custo_profissional,
    });
  } catch (error) {
    console.error('[config/pagamento/GET]', error);
    if (
      email &&
      isDevBypassAuthActive() &&
      (isSupabaseNetworkError(error) || isSupabaseMissingColumnError(error))
    ) {
      return devFallbackResponse(email);
    }
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar configuração') },
      { status: supabaseErrorStatus(error) },
    );
  }
}

export async function PUT(req: NextRequest) {
  let email: string | undefined;
  let merged: ConfigPagamentoMetodos = defaultConfigPagamento();
  let repassar = false;

  try {
    const authResult = await requireVerifiedOwner();
    if (isAuthError(authResult)) return authResult;
    email = authResult.email;

    const body = await req.json();
    const configInput = body.config as ConfigPagamentoMetodos | undefined;
    repassar = !!body.repassar_custo_profissional;

    merged = normalizeConfig(
      sanitizeConfigPagamento({ ...defaultConfigPagamento(), ...(configInput ?? {}) }),
    );

    const { error } = await supabaseAdmin
      .from('onboarding_profiles')
      .update({
        config_pagamento_metodos: merged,
        repassar_custo_profissional: repassar,
      })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({
      config: merged,
      repassar_custo_profissional: repassar,
      message: 'Configuração salva',
    });
  } catch (error) {
    console.error('[config/pagamento/PUT]', error);
    if (
      email &&
      isDevBypassAuthActive() &&
      (isSupabaseNetworkError(error) || isSupabaseMissingColumnError(error))
    ) {
      devConfigPagamentoSet(email, merged, repassar);
      return NextResponse.json({
        config: merged,
        repassar_custo_profissional: repassar,
        message: 'Configuração salva (modo dev, memória local do servidor)',
        devFallback: true,
      });
    }
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao salvar configuração') },
      { status: supabaseErrorStatus(error) },
    );
  }
}
