"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type {
  DivergenciaGoogle,
  DivergenciaMotivo,
  VerificacaoGoogleResult,
} from "@/lib/agendaGoogleVerificacao";
import type { AgendaLogRow } from "@/lib/consultasAgendaLog";

const REVERIFY_ON_FOCUS_MS = 10 * 60_000;

const ACAO_LABEL: Record<string, string> = {
  sessao_criada: "Sessão criada na Turquesa",
  sessao_editada: "Sessão salva na Turquesa",
  sessao_excluida: "Sessão excluída na Turquesa",
  duplicata_removida: "Removida como duplicata",
  google_criado: "Evento criado no Google",
  google_atualizado: "Evento atualizado no Google",
  google_excluido: "Evento excluído no Google",
  google_erro: "Erro ao falar com o Google",
  divergencia_reenviada: "Reenviada ao Google (verificação)",
  divergencia_cancelada: "Cancelada na Turquesa (verificação)",
};

const ORIGEM_LABEL: Record<string, string> = {
  usuario: "salvo pelo salão",
  agenda_navegador: "pela agenda no navegador",
  fila_google: "fila automática",
  sincronizar_tudo: "Sincronizar com Google",
  limpeza_duplicatas: "limpeza automática de duplicatas",
  excluir_sessao: "exclusão de sessão",
  verificacao_google: "verificação Google",
};

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function motivoTexto(d: DivergenciaGoogle): string {
  const textos: Record<DivergenciaMotivo, string> = {
    sem_evento: "Nunca chegou ao Google.",
    evento_excluido_no_google: `O evento foi excluído no Google${
      d.googleAtualizadoEm ? ` (última alteração ${fmtDataHora(d.googleAtualizadoEm)})` : ""
    }.`,
    evento_nao_encontrado: "O evento não existe em nenhuma agenda Google do salão.",
    horario_diferente: `No Google está em ${fmtDataHora(d.googleInicio)}.`,
    agenda_sem_acesso: "Sem acesso à agenda Google da profissional — peça para reconectar.",
  };
  return textos[d.motivo];
}

function detalheTexto(row: AgendaLogRow): string {
  const det = row.detalhe ?? {};
  const parts: string[] = [];
  if (typeof det.motivo === "string") parts.push(det.motivo.replace(/_/g, " "));
  if (typeof det.operacao === "string") parts.push(det.operacao.replace(/_/g, " "));
  if (det.status_evento === "cancelled") parts.push("evento estava excluído no Google");
  if (typeof det.erro === "string" && det.erro) parts.push(det.erro);
  if (typeof det.inicio_anterior === "string") {
    parts.push(`antes: ${fmtDataHora(det.inicio_anterior)}`);
  }
  if (typeof det.profissional_anterior === "string") {
    parts.push(`profissional antes: ${det.profissional_anterior}`);
  }
  return parts.join(" · ");
}

function Historico({ consultaId }: { consultaId: string }) {
  const [log, setLog] = useState<AgendaLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/agenda/google-verificacao/historico?consultaId=${encodeURIComponent(consultaId)}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => ({}))) as { log?: AgendaLogRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Falha ao carregar histórico.");
        else setLog(data.log ?? []);
      } catch {
        if (!cancelled) setError("Falha ao carregar histórico.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultaId]);

  if (error) return <p className="mt-2 text-xs text-red-600">{error}</p>;
  if (!log) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando histórico...
      </p>
    );
  }
  if (log.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        Sem registros ainda (o histórico começou a ser gravado agora).
      </p>
    );
  }
  return (
    <ol className="mt-2 space-y-1 border-l border-slate-200 pl-3">
      {log.map((row) => {
        const det = detalheTexto(row);
        return (
          <li key={row.id} className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{fmtDataHora(row.created_at)}</span>{" "}
            — {ACAO_LABEL[row.acao] ?? row.acao}
            <span className="text-slate-400"> ({ORIGEM_LABEL[row.origem] ?? row.origem})</span>
            {det ? <span className="block text-slate-500">{det}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function DivergenciaItem({
  item,
  onResolved,
}: {
  item: DivergenciaGoogle;
  onResolved: () => void;
}) {
  const [busy, setBusy] = useState<"reenviar" | "cancelar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const agir = async (acao: "reenviar" | "cancelar") => {
    if (
      acao === "cancelar" &&
      !window.confirm(
        `Cancelar na Turquesa a sessão de ${item.paciente} (${fmtDataHora(item.inicio)})?`,
      )
    ) {
      return;
    }
    setBusy(acao);
    setError(null);
    try {
      const res = await fetch("/api/agenda/google-verificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultaId: item.id, acao }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível concluir.");
        return;
      }
      onResolved();
    } catch {
      setError("Erro de rede. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="rounded-xl border border-amber-200 bg-white px-3 py-2.5">
      <p className="text-sm font-semibold text-slate-900">
        {fmtDataHora(item.inicio)} · {item.paciente}
        {item.medico ? <span className="font-normal text-slate-600"> · {item.medico}</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-amber-800">{motivoTexto(item)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void agir("reenviar")}
          disabled={!!busy}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#047482]/30 bg-[#eef4f5] px-3 text-xs font-semibold text-[#047482] hover:bg-[#D9F0F2] disabled:opacity-60 touch-manipulation"
        >
          {busy === "reenviar" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {item.motivo === "horario_diferente" ? "Corrigir horário no Google" : "Reenviar ao Google"}
        </button>
        <button
          type="button"
          onClick={() => void agir("cancelar")}
          disabled={!!busy}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 touch-manipulation"
        >
          {busy === "cancelar" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Cancelar na Turquesa
        </button>
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          aria-expanded={showLog}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2 text-xs font-medium text-slate-500 hover:text-slate-700 touch-manipulation"
        >
          Histórico
          {showLog ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
      {showLog ? <Historico consultaId={item.id} /> : null}
    </li>
  );
}

/** Confere se as sessões futuras da Turquesa estão no Google; decisão sempre manual. */
export default function AgendaGoogleVerificacaoCard({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged?: () => void;
}) {
  const [result, setResult] = useState<VerificacaoGoogleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const lastRunRef = useRef(0);
  const runningRef = useRef(false);

  const verificar = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agenda/google-verificacao", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as VerificacaoGoogleResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Falha ao conferir o Google.");
        return;
      }
      setResult(data);
      lastRunRef.current = Date.now();
    } catch {
      setError("Falha ao conferir o Google.");
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void verificar();
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRunRef.current > REVERIFY_ON_FOCUS_MS) void verificar();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [enabled, verificar]);

  const handleResolved = useCallback(() => {
    onChanged?.();
    void verificar();
  }, [onChanged, verificar]);

  if (!enabled || result?.semGoogle) return null;

  const divergencias = result?.divergencias ?? [];
  const verificadoEm = result?.verificadoEm
    ? new Date(result.verificadoEm).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const conferirBtn = (
    <button
      type="button"
      onClick={() => void verificar()}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      Conferir agora
    </button>
  );

  if (error) {
    return (
      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-red-600">
        <span>Não consegui conferir o Google: {error}</span>
        {conferirBtn}
      </p>
    );
  }

  if (!result) {
    return (
      <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Conferindo sessões no Google...
      </p>
    );
  }

  if (divergencias.length === 0) {
    return (
      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          {result.verificadas} sessões dos próximos {result.dias} dias conferidas no Google
          {verificadoEm ? ` às ${verificadoEm}` : ""}.
        </span>
        {conferirBtn}
      </p>
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 text-left text-sm font-semibold text-amber-900 touch-manipulation"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {divergencias.length === 1
            ? "1 sessão da Turquesa não está certa no Google"
            : `${divergencias.length} sessões da Turquesa não estão certas no Google`}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="flex items-center gap-2 text-xs text-amber-800">
          {verificadoEm ? `conferido às ${verificadoEm}` : null}
          {conferirBtn}
        </span>
      </div>
      {expanded ? (
        <>
          <p className="mt-1 text-xs text-amber-800">
            Nada é corrigido sozinho: para cada sessão, escolha reenviar ao Google ou, se o
            cancelamento foi de propósito, cancelar na Turquesa.
          </p>
          <ul className="mt-2 space-y-2">
            {divergencias.map((item) => (
              <DivergenciaItem key={item.id} item={item} onResolved={handleResolved} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
