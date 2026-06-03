// ============================================================
// Utilitário de exportação CSV
// ============================================================

import { planosDaConsulta, servicoDaConsulta } from '@/lib/backupHelpers';
import { STATUS_CONSULTA_UI, TIPO_CONSULTA_UI } from '@/lib/consultations';
import type { ConsultationEvent, Transacao } from './types';

interface CsvExportData {
  events: ConsultationEvent[];
  financeiro: Transacao[];
}

/** Gera CSV completo: pacientes, consultas, faturamento e splits */
export function gerarCsvCompleto({ events, financeiro }: CsvExportData): string {
  const linhas: string[] = [];

  // Seção 1: Consultas (agenda)
  linhas.push("=== CONSULTAS (AGENDA) ===");
  linhas.push(
    "Título;Paciente;Serviço;Plano/Convênio;Tipo;Status;Valor;Início;Fim;Endereço;Google Calendar",
  );
  for (const e of events) {
    const planos = planosDaConsulta(e);
    linhas.push(
      [
        e.title ?? "",
        e.patient ?? "",
        servicoDaConsulta(e),
        planos.length > 0 ? planos.join(" | ") : "",
        e.tipoConsulta ? TIPO_CONSULTA_UI[e.tipoConsulta]?.label ?? e.tipoConsulta : "",
        e.status ? STATUS_CONSULTA_UI[e.status]?.label ?? e.status : "",
        (e.value ?? 0).toFixed(2),
        e.start?.toString() ?? "",
        e.end?.toString() ?? "",
        e.location ?? "",
        e.googleEventId ? "Sim" : "Não",
      ].join(";"),
    );
  }

  // Resumo financeiro da agenda
  const countConsultas = events.length;
  const pacientesUnicos = new Set(events.map((e) => e.patient).filter(Boolean)).size;
  const faturamentoTotal = events.reduce((s, e) => s + (e.value ?? 0), 0);

  linhas.push("");
  linhas.push("=== RESUMO FINANCEIRO (AGENDA) ===");
  linhas.push("Faturamento Total;Pacientes Únicos;Consultas");
  linhas.push(`${faturamentoTotal.toFixed(2)};${pacientesUnicos};${countConsultas}`);

  // Seção 3: Financeiro (transações)
  linhas.push("");
  linhas.push("=== TRANSAÇÕES FINANCEIRAS ===");
  linhas.push("Tipo;Descrição;Data;Categoria;Médico;Valor;Observação;Splits");
  for (const t of financeiro) {
    const splitsStr = t.splits
      ? t.splits
          .map(
            (s) =>
              `${s.medico}: ${s.porcentagem}% (R$ ${s.valor_split.toFixed(2)})`,
          )
          .join(" | ")
      : "";
    linhas.push(
      [
        t.tipo === "entrada" ? "Entrada" : "Saída",
        t.descricao,
        t.data ?? "",
        t.categoria ?? "",
        t.medico ?? "",
        t.valor.toFixed(2),
        t.observacao ?? "",
        splitsStr,
      ].join(";"),
    );
  }

  // Totais financeiros
  const faturamentoFinanceiro = financeiro
    .filter((t) => t.tipo === "entrada")
    .reduce((s, t) => s + t.valor, 0);
  const despesasFinanceiro = financeiro
    .filter((t) => t.tipo === "saida")
    .reduce((s, t) => s + t.valor, 0);

  linhas.push("");
  linhas.push("=== TOTAIS FINANCEIROS ===");
  linhas.push("Entradas;Saídas;Saldo");
  linhas.push(
    `${faturamentoFinanceiro.toFixed(2)};${despesasFinanceiro.toFixed(
      2,
    )};${(faturamentoFinanceiro - despesasFinanceiro).toFixed(2)}`,
  );

  // Metadados
  linhas.push("");
  linhas.push("=== METADADOS ===");
  linhas.push("Exportado em;Aplicativo");
  linhas.push(`${new Date().toLocaleString("pt-BR")};MedSupApp`);

  return linhas.join("\n");
}

/** Download de CSV no navegador */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
