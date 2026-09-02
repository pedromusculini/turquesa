'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import type { ClienteCrmListaItem, CrmSegmento } from '@/lib/clientesCrmSegments';
import type { SemRetornoSort } from '@/lib/clientesCrmConstants';
import { openWhatsAppUrl } from '@/lib/openExternalUrl';

type Props = {
  segmento: CrmSegmento;
  titulo: string;
  descricao: string;
  total: number;
  onSelectCliente?: (id: string) => void;
  showWhatsApp?: boolean;
  diasLimite?: number;
  onDiasLimiteChange?: (dias: number) => void;
  diasOptions?: number[];
};

export default function ClientesCrmSegmentoPanel({
  segmento,
  titulo,
  descricao,
  total,
  onSelectCliente,
  showWhatsApp = false,
  diasLimite,
  onDiasLimiteChange,
  diasOptions = [30, 60, 90, 120],
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SemRetornoSort>('desc');
  const [lista, setLista] = useState<ClienteCrmListaItem[]>([]);
  const [meta, setMeta] = useState<{ page: number; total_pages: number; total: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waLoadingId, setWaLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        segmento,
        page: String(page),
        sort,
      });
      if (segmento === 'sem_retorno' && diasLimite) params.set('dias', String(diasLimite));
      const res = await fetch(`/api/clientes/crm/segmento?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      const payload = data.segmento as {
        clientes: ClienteCrmListaItem[];
        page: number;
        total_pages: number;
        total: number;
      };
      setLista(payload.clientes);
      setMeta({
        page: payload.page,
        total_pages: payload.total_pages,
        total: payload.total,
      });
      if (payload.page !== page) setPage(payload.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setLista([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [segmento, page, sort, diasLimite]);

  useEffect(() => {
    if (!aberto) return;
    void load();
  }, [aberto, load]);

  function changeSort(next: SemRetornoSort) {
    if (next === sort) return;
    setSort(next);
    setPage(1);
  }

  async function abrirWhatsApp(clienteId: string) {
    setWaLoadingId(clienteId);
    try {
      const params = diasLimite ? `?dias=${diasLimite}` : '';
      const res = await fetch(`/api/resgate/mensagem/${clienteId}${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      if (data.whatsapp_url) {
        openWhatsAppUrl(data.whatsapp_url, {
          appUrl: data.whatsapp_app_url ?? undefined,
          androidUrl: data.whatsapp_android_url ?? undefined,
        });
      }
    } catch {
      /* silencioso */
    } finally {
      setWaLoadingId(null);
    }
  }

  async function exportarCsv() {
    try {
      const params = new URLSearchParams({
        segmento,
        page: '1',
        limit: '500',
        sort,
      });
      if (segmento === 'sem_retorno' && diasLimite) params.set('dias', String(diasLimite));
      const res = await fetch(`/api/clientes/crm/segmento?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) return;
      const rows = (data.segmento?.clientes ?? []) as ClienteCrmListaItem[];
      const header =
        segmento === 'top_clientes'
          ? 'nome;telefone;valor_total;detalhe\n'
          : 'nome;telefone;detalhe\n';
      const body = rows
        .map((r) => {
          const cols =
            segmento === 'top_clientes'
              ? [
                  r.nome,
                  r.telefone ?? '',
                  typeof r.valor_num === 'number'
                    ? r.valor_num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : '0,00',
                  r.detalhe ?? '',
                ]
              : [r.nome, r.telefone ?? '', r.detalhe ?? ''];
          return cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';');
        })
        .join('\n');
      const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${segmento}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* silencioso */
    }
  }

  const rangeStart = meta && meta.total > 0 ? (meta.page - 1) * 20 + 1 : 0;
  const rangeEnd = meta ? Math.min(meta.page * 20, meta.total) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={aberto}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
            {total > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {total}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">{descricao}</p>
        </div>
        {aberto ? (
          <ChevronUp className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>

      {aberto && (
        <>
          {segmento === 'sem_retorno' && onDiasLimiteChange && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">Período:</span>
              {diasOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onDiasLimiteChange(d);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    diasLimite === d
                      ? 'bg-amber-100 text-amber-900'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d}+ dias
                </button>
              ))}
            </div>
          )}

          {segmento === 'sem_retorno' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => changeSort('desc')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  sort === 'desc' ? 'bg-amber-100 text-amber-900' : 'border border-slate-200 text-slate-600'
                }`}
              >
                Mais dias sem retorno
              </button>
              <button
                type="button"
                onClick={() => changeSort('asc')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  sort === 'asc' ? 'bg-amber-100 text-amber-900' : 'border border-slate-200 text-slate-600'
                }`}
              >
                Menos dias sem retorno
              </button>
              <button
                type="button"
                onClick={() => void exportarCsv()}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" aria-hidden />
                Exportar CSV
              </button>
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Carregando…
            </div>
          )}

          {!loading && error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {!loading && !error && total === 0 && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
              Nenhuma cliente neste grupo.
            </p>
          )}

          {!loading && !error && lista.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100">
              {lista.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-3">
                  <button
                    type="button"
                    onClick={() => onSelectCliente?.(c.id)}
                    className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50 -mx-2"
                  >
                    <p className="truncate font-medium text-slate-900">{c.nome}</p>
                    {c.detalhe && <p className="text-xs text-slate-500">{c.detalhe}</p>}
                  </button>
                  {segmento === 'top_clientes' && typeof c.valor_num === 'number' && (
                    <span className="shrink-0 rounded-full bg-[#eef4f5] px-2.5 py-1 text-xs font-semibold text-[#047482]">
                      {c.valor_num.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  )}
                  {showWhatsApp && c.telefone && (
                    <button
                      type="button"
                      disabled={waLoadingId === c.id}
                      onClick={() => void abrirWhatsApp(c.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1da851] disabled:opacity-50"
                      title="Enviar mensagem de resgate"
                    >
                      {waLoadingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5" />
                      )}
                      WA
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!loading && meta && meta.total_pages > 1 && (
            <div className="mt-4 flex flex-col items-center gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
              <p className="text-sm text-slate-600">
                {rangeStart}–{rangeEnd} de {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={meta.page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Anterior
                </button>
                <span className="min-w-[7rem] text-center text-sm text-slate-600">
                  Página {meta.page} de {meta.total_pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                  disabled={meta.page >= meta.total_pages}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
