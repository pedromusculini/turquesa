import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  calcularRepasseProfissional,
  calcularTaxaPagamento,
  defaultConfigPagamento,
  metodoIdFromForma,
  sanitizeConfigPagamento,
  type ConfigPagamentoMetodos,
} from '@/lib/configPagamento';

export type RegistrarEntradaParams = {
  ownerEmail: string;
  descricao: string;
  data: string;
  valorBruto: number;
  categoria?: string | null;
  medico: string;
  observacao?: string | null;
  formaPagamento?: string | null;
  parcelas?: number;
  percentualProfissional: number;
  configPagamento?: ConfigPagamentoMetodos;
  repassarCusto?: boolean;
};

export async function registrarEntradaFinanceira(params: RegistrarEntradaParams) {
  const {
    ownerEmail,
    descricao,
    data,
    valorBruto,
    categoria = 'consulta',
    medico,
    observacao = null,
    formaPagamento = null,
    parcelas = 1,
    percentualProfissional,
    configPagamento,
    repassarCusto: repassarCustoParam,
  } = params;

  let config = configPagamento ?? defaultConfigPagamento();
  let repassarCusto = repassarCustoParam ?? false;

  if (!configPagamento || repassarCustoParam === undefined) {
    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('config_pagamento_metodos, repassar_custo_profissional')
      .eq('email', ownerEmail)
      .maybeSingle();

    if (profile?.config_pagamento_metodos) {
      config = sanitizeConfigPagamento(
        profile.config_pagamento_metodos as ConfigPagamentoMetodos,
      );
    }
    if (repassarCustoParam === undefined) {
      repassarCusto = !!profile?.repassar_custo_profissional;
    }
  }

  const metodoId = formaPagamento ? metodoIdFromForma(formaPagamento, parcelas) : null;
  const taxaCalc = calcularTaxaPagamento(valorBruto, metodoId, config);
  const repasse = calcularRepasseProfissional(
    valorBruto,
    taxaCalc,
    percentualProfissional,
    repassarCusto,
  );

  const insertPayload: Record<string, unknown> = {
    tipo: 'entrada',
    descricao,
    data,
    valor: repasse.valorBruto,
    categoria,
    medico,
    observacao,
    owner_email: ownerEmail,
    forma_pagamento: formaPagamento,
    parcelas,
    valor_bruto: repasse.valorBruto,
    taxa_pagamento: repasse.taxaPagamento,
    valor_liquido: repasse.valorLiquido,
    percentual_profissional: repasse.percentualProfissional,
    valor_profissional: repasse.valorProfissional,
    valor_salao: repasse.valorSalao,
    repassar_custo: repassarCusto,
  };

  const { data: transacao, error } = await supabaseAdmin
    .from('financeiro_transacoes')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return { transacao, repasse };
}

/** Busca percentual padrão da profissional pelo nome */
export async function percentualProfissionalPadrao(
  ownerEmail: string,
  nomeProfissional: string,
): Promise<number> {
  const nome = nomeProfissional.trim();
  if (!nome) return 50;

  const { data: medicos } = await supabaseAdmin
    .from('clinica_medicos')
    .select('nome, percentual_comissao')
    .eq('clinica_email', ownerEmail);

  const match = (medicos ?? []).find(
    (m) => m.nome?.trim().toLowerCase() === nome.toLowerCase(),
  );
  if (match?.percentual_comissao != null) return Number(match.percentual_comissao);

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('full_name, user_type')
    .eq('email', ownerEmail)
    .maybeSingle();

  if (
    profile?.full_name?.trim().toLowerCase() === nome.toLowerCase() ||
    profile?.user_type === 'medico'
  ) {
    return 100;
  }

  return 50;
}

/** Último percentual usado em entrada para a profissional */
export async function ultimoPercentualProfissional(
  ownerEmail: string,
  nomeProfissional: string,
): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from('financeiro_transacoes')
    .select('percentual_profissional')
    .eq('owner_email', ownerEmail)
    .eq('tipo', 'entrada')
    .eq('medico', nomeProfissional.trim())
    .not('percentual_profissional', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.percentual_profissional != null) return Number(data.percentual_profissional);
  return null;
}
