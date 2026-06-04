/** Textos de UI para lembretes (sem dependências de servidor). */

export type LembretesSettingsUi = {
  lembrete_antecedencia_ativo: boolean;
  lembrete_antecedencia_dias: number;
  lembrete_1_dia_ativo: boolean;
};

export const DEFAULT_LEMBRETES_SETTINGS_UI: LembretesSettingsUi = {
  lembrete_antecedencia_ativo: true,
  lembrete_antecedencia_dias: 7,
  lembrete_1_dia_ativo: true,
};

export function tituloDiasAntes(dias: number): string {
  return dias === 1 ? '1 dia antes' : `${dias} dias antes`;
}

export function formatLembretesDashboardHint(s: LembretesSettingsUi): string {
  const parts: string[] = [];
  if (s.lembrete_antecedencia_ativo) {
    parts.push(tituloDiasAntes(s.lembrete_antecedencia_dias));
  }
  if (s.lembrete_1_dia_ativo) {
    parts.push('1 dia antes');
  }
  if (parts.length === 0) return 'lembretes desativados em Configurações';
  return parts.join(' e ');
}

export function formatLembretesResumoAntesSessao(s: LembretesSettingsUi): string {
  const parts: string[] = [];
  if (s.lembrete_antecedencia_ativo) {
    const d = s.lembrete_antecedencia_dias;
    parts.push(d === 1 ? '1 dia' : `${d} dias`);
  }
  if (s.lembrete_1_dia_ativo) parts.push('1 dia');
  if (parts.length === 0) return 'conforme Configurações';
  return parts.join(' e ');
}

export function mensagemLembreteLabel(
  key: 'lembrete_7_dias' | 'lembrete_1_dia',
  s: LembretesSettingsUi,
): string {
  if (key === 'lembrete_1_dia') return 'Lembrete 1 dia antes';
  return `Lembrete — ${tituloDiasAntes(s.lembrete_antecedencia_dias)}`;
}

export function mensagemLembreteQuando(
  key: 'lembrete_7_dias' | 'lembrete_1_dia',
  s: LembretesSettingsUi,
): string {
  if (key === 'lembrete_1_dia') {
    return 'Lembrete no Dashboard, 1 dia antes da sessão (botão WhatsApp).';
  }
  const diasTxt =
    s.lembrete_antecedencia_dias === 1
      ? '1 dia'
      : `${s.lembrete_antecedencia_dias} dias`;
  return `Lembrete no Dashboard, ${diasTxt} antes da sessão (botão WhatsApp).`;
}
