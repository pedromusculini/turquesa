'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultConfigPagamento,
  METODOS_PAGAMENTO_IDS,
  METODOS_PAGAMENTO_LABELS,
  type ConfigPagamentoMetodos,
  type MetodoPagamentoConfig,
  type MetodoPagamentoId,
} from '@/lib/configPagamento';
import {
  formatDecimalBr,
  isDecimalBrInput,
  parseDecimalBr,
} from '@/lib/decimalBr';

function parseApiError(e: unknown, fallback: string): string {
  if (e instanceof TypeError) {
    const msg = e.message.toLowerCase();
    if (msg.includes('fetch') || msg.includes('network')) {
      return 'Não foi possível conectar ao servidor. Verifique se o app está rodando e sua conexão.';
    }
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(
      res.ok
        ? 'Resposta inválida do servidor'
        : `Erro ${res.status}: não foi possível ler a resposta`,
    );
  }
}

type DraftInputs = Partial<Record<MetodoPagamentoId, string>>;

function metodoToDraft(id: MetodoPagamentoId, metodo: MetodoPagamentoConfig | undefined): string {
  if (!metodo) return id === 'pix' ? '0,00' : '0';
  if (metodo.tipo === 'fixo') {
    return formatDecimalBr(metodo.valor_centavos / 100, 2);
  }
  return formatDecimalBr(metodo.percentual);
}

function configToDrafts(config: ConfigPagamentoMetodos): DraftInputs {
  const defaults = defaultConfigPagamento();
  const drafts: DraftInputs = {};
  for (const id of METODOS_PAGAMENTO_IDS) {
    drafts[id] = metodoToDraft(id, config[id] ?? defaults[id]);
  }
  return drafts;
}

function draftsToConfig(
  drafts: DraftInputs,
  base: ConfigPagamentoMetodos = defaultConfigPagamento(),
): ConfigPagamentoMetodos {
  const next = { ...base };
  for (const id of METODOS_PAGAMENTO_IDS) {
    const num = parseDecimalBr(drafts[id] ?? '');
    if (id === 'pix') {
      next[id] = { tipo: 'fixo', valor_centavos: Math.round(num * 100) };
    } else {
      next[id] = { tipo: 'percentual', percentual: num };
    }
  }
  return next;
}

function normalizeDraft(id: MetodoPagamentoId, raw: string): string {
  const num = parseDecimalBr(raw);
  if (id === 'pix') return formatDecimalBr(num, 2);
  return formatDecimalBr(num);
}

export default function ConfigPagamentoSection() {
  const [config, setConfig] = useState<ConfigPagamentoMetodos>(defaultConfigPagamento());
  const [draftInputs, setDraftInputs] = useState<DraftInputs>(() =>
    configToDrafts(defaultConfigPagamento()),
  );
  const [repassar, setRepassar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/pagamento');
      const data = await readJsonResponse(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Erro ao carregar configuração',
        );
      }
      const loaded =
        (data.config as ConfigPagamentoMetodos | undefined) ?? defaultConfigPagamento();
      setConfig(loaded);
      setDraftInputs(configToDrafts(loaded));
      setRepassar(!!data.repassar_custo_profissional);
      if (data.devFallback) {
        setMessage('Modo dev: configuração em memória (Supabase indisponível ou migração pendente).');
      }
    } catch (e) {
      setError(parseApiError(e, 'Erro ao carregar'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleDraftChange(id: MetodoPagamentoId, value: string) {
    if (!isDecimalBrInput(value)) return;
    setDraftInputs((prev) => ({ ...prev, [id]: value }));
  }

  function handleDraftBlur(id: MetodoPagamentoId) {
    setDraftInputs((prev) => {
      const normalized = normalizeDraft(id, prev[id] ?? '');
      const nextDrafts = { ...prev, [id]: normalized };
      setConfig((current) => draftsToConfig(nextDrafts, current));
      return nextDrafts;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const finalConfig = draftsToConfig(draftInputs, config);
    const normalizedDrafts = configToDrafts(finalConfig);
    setConfig(finalConfig);
    setDraftInputs(normalizedDrafts);
    try {
      const res = await fetch('/api/config/pagamento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: finalConfig, repassar_custo_profissional: repassar }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Erro ao salvar configuração',
        );
      }
      setMessage(
        typeof data.message === 'string'
          ? data.message
          : 'Configuração salva com sucesso.',
      );
    } catch (e) {
      setError(parseApiError(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <p className="text-sm text-gray-500">Carregando meios de pagamento...</p>
      </section>
    );
  }

  return (
    <section
      data-tour="config-taxas-pagamento"
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-bold text-gray-900">Meios de pagamento e taxas</h2>
      <p className="mt-1 text-sm text-gray-500">
        Cadastre o custo de cada forma de recebimento. Usado no relatório de repasse às
        profissionais.
      </p>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-bg-onboarding)]/80 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={repassar}
          onChange={(e) => setRepassar(e.target.checked)}
          className="mt-1 rounded border-gray-300 text-[var(--brand-primary)]"
        />
        <span className="text-sm text-gray-700">
          <strong>Repassar custo da taxa para a profissional</strong> — desconta a taxa do meio de
          pagamento antes de calcular a comissão (% sobre o valor líquido).
        </span>
      </label>

      <div className="mt-6 space-y-3">
        {METODOS_PAGAMENTO_IDS.map((id) => {
          const isPix = id === 'pix';
          return (
            <div
              key={id}
              className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium text-gray-800">
                {METODOS_PAGAMENTO_LABELS[id]}
              </span>
              <div className="flex items-center gap-2">
                {isPix ? (
                  <>
                    <span className="text-xs text-gray-500">Taxa fixa R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      value={draftInputs[id] ?? '0,00'}
                      onChange={(e) => handleDraftChange(id, e.target.value)}
                      onBlur={() => handleDraftBlur(id)}
                    />
                  </>
                ) : (
                  <>
                    <span className="text-xs text-gray-500">Taxa %</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      value={draftInputs[id] ?? '0'}
                      onChange={(e) => handleDraftChange(id, e.target.value)}
                      onBlur={() => handleDraftBlur(id)}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-6 rounded-xl bg-[#047482] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b] disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Salvar configuração'}
      </button>
    </section>
  );
}
