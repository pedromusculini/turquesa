'use client';

import { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import {
  MOBILE_MODAL_OVERLAY,
  MOBILE_MODAL_SHEET,
  useBodyScrollLock,
} from '@/lib/useBodyScrollLock';
import type { CategoriaSaida } from '@/lib/configCategoriasSaida';
import { categoriaSaidaLabel } from '@/lib/configCategoriasSaida';

const CATEGORIAS_ENTRADA = ['consulta', 'procedimento', 'exame', 'outro'];

const CATEGORIA_LABELS_ENTRADA: Record<string, string> = {
  consulta: 'Atendimento',
  procedimento: 'Procedimento',
  exame: 'Exame',
  outro: 'Outro',
};

type SplitDraft = { medico: string; porcentagem: string };

export type FinanceiroTransacaoCriada = {
  id: string;
  tipo: 'entrada' | 'saida';
  descricao: string;
  data: string;
  valor: number;
  categoria: string | null;
  medico: string | null;
  observacao: string | null;
  created_at: string;
  splits: {
    id: string;
    transacao_id: string;
    medico: string;
    porcentagem: number;
    valor_split: number;
  }[];
  valor_bruto?: number | null;
  taxa_pagamento?: number | null;
  valor_liquido?: number | null;
  percentual_profissional?: number | null;
  valor_profissional?: number | null;
  valor_salao?: number | null;
  forma_pagamento?: string | null;
  catalogo_itens?: unknown;
};

export type FinanceiroTransacaoEditavel = FinanceiroTransacaoCriada;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (transacao: FinanceiroTransacaoCriada) => void;
  onUpdated?: (transacao: FinanceiroTransacaoCriada) => void;
  medicosOptions: { value: string; label: string }[];
  /** Pré-seleciona entrada ou despesa ao abrir (somente criação). */
  initialTipo?: 'entrada' | 'saida';
  /** Edição de despesa existente. */
  editing?: FinanceiroTransacaoEditavel | null;
  categoriasSaida: CategoriaSaida[];
};

function emptyForm() {
  return {
    tipo: 'entrada' as 'entrada' | 'saida',
    descricao: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    valor: '',
    categoria: '',
    medico: '',
    observacao: '',
    splits: [] as SplitDraft[],
  };
}

function FinanceiroNovaTransacaoModal({
  open,
  onClose,
  onCreated,
  onUpdated,
  medicosOptions,
  initialTipo = 'entrada',
  editing = null,
  categoriasSaida,
}: Props) {
  const isEditing = !!editing;
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [medico, setMedico] = useState('');
  const [observacao, setObservacao] = useState('');
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo('saida');
      setDescricao(editing.descricao);
      setData(editing.data?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'));
      setValor(String(editing.valor));
      setCategoria(editing.categoria ?? '');
      setMedico('');
      setObservacao(editing.observacao ?? '');
      setSplits([]);
      setSubmitLoading(false);
      setSubmitError(null);
      return;
    }
    const initial = emptyForm();
    setTipo(initialTipo);
    setDescricao(initial.descricao);
    setData(initial.data);
    setValor(initial.valor);
    setCategoria(initial.categoria);
    setMedico(initial.medico);
    setObservacao(initial.observacao);
    setSplits(initial.splits);
    setSubmitLoading(false);
    setSubmitError(null);
  }, [open, editing, initialTipo]);

  const addSplit = () => {
    setSplits((prev) => [...prev, { medico: '', porcentagem: '' }]);
  };

  const removeSplit = (idx: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSplit = (
    idx: number,
    field: 'medico' | 'porcentagem',
    value: string,
  ) => {
    setSplits((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = {
        tipo,
        descricao,
        data,
        valor: parseFloat(valor),
        categoria: categoria || null,
        medico: medico || null,
        observacao: observacao || null,
      };

      if (tipo === 'entrada' && splits.length > 0) {
        const totalPct = splits.reduce(
          (sum, s) => sum + (parseFloat(s.porcentagem) || 0),
          0,
        );
        if (Math.abs(totalPct - 100) > 0.01) {
          setSubmitError('A soma das porcentagens dos splits deve ser 100%');
          setSubmitLoading(false);
          return;
        }
        payload.splits = splits.map((s) => ({
          medico: s.medico,
          porcentagem: parseFloat(s.porcentagem),
        }));
      }

      const res = await fetch('/api/financeiro', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEditing
            ? {
                id: editing!.id,
                descricao,
                data,
                valor: parseFloat(valor),
                categoria: categoria || null,
                observacao: observacao || null,
              }
            : payload,
        ),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(
          errData.error ||
            (isEditing ? 'Erro ao atualizar despesa' : 'Erro ao registrar transação'),
        );
      }

      const saved = (await res.json()) as FinanceiroTransacaoCriada;
      onClose();
      if (isEditing) {
        onUpdated?.(saved);
      } else {
        onCreated(saved);
      }
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Erro ao registrar transação',
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const medicoSuggestions = medicosOptions.map((m) => m.value);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={MOBILE_MODAL_OVERLAY}>
      <div className={`${MOBILE_MODAL_SHEET} max-w-2xl p-6 sm:p-8`}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-950">
            {isEditing ? 'Editar despesa' : 'Nova transação'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {submitError && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEditing && (
            <div>
              <label className="block text-sm font-semibold text-slate-700">Tipo *</label>
              <div className="mt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => setTipo('entrada')}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    tipo === 'entrada'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  Entrada (receita)
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('saida')}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    tipo === 'saida'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  Saída (despesa)
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Descrição *
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={
                tipo === 'entrada' ? 'Ex: Corte — Maria' : 'Ex: Aluguel do salão'
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Data *</label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Selecione...</option>
              {tipo === 'entrada'
                ? CATEGORIAS_ENTRADA.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORIA_LABELS_ENTRADA[cat] ?? cat}
                    </option>
                  ))
                : categoriasSaida.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
              {tipo === 'saida' &&
              categoria &&
              !categoriasSaida.some((c) => c.id === categoria) ? (
                <option value={categoria}>{categoriaSaidaLabel(categoria, categoriasSaida)}</option>
              ) : null}
            </select>
            {tipo === 'saida' && (
              <p className="mt-1.5 text-xs text-slate-500">
                <Link
                  href="/dashboard/configuracoes/pagamento"
                  className="font-medium text-[#047482] hover:underline"
                  onClick={onClose}
                >
                  Editar categorias de despesa
                </Link>
              </p>
            )}
          </div>

          {tipo === 'entrada' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Profissional responsável
              </label>
              <input
                type="text"
                list="financeiro-medicos-suggestions"
                value={medico}
                onChange={(e) => setMedico(e.target.value)}
                placeholder="Ex: João Silva"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <datalist id="financeiro-medicos-suggestions">
                {medicoSuggestions.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Observação
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Notas adicionais..."
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {tipo === 'entrada' && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Split por profissional (opcional)
                </label>
                <button
                  type="button"
                  onClick={addSplit}
                  className="rounded-xl border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
                >
                  + Adicionar split
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Defina a porcentagem que cada profissional recebe. A soma deve ser 100%.
              </p>

              {splits.length > 0 && (
                <div className="mt-3 space-y-2">
                  {splits.map((split, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-[#eef4f5] p-3"
                    >
                      <input
                        type="text"
                        value={split.medico}
                        onChange={(e) => updateSplit(idx, 'medico', e.target.value)}
                        placeholder="Nome da profissional"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={split.porcentagem}
                        onChange={(e) =>
                          updateSplit(idx, 'porcentagem', e.target.value)
                        }
                        placeholder="%"
                        className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
                      />
                      <span className="text-sm text-slate-400">%</span>
                      <button
                        type="button"
                        onClick={() => removeSplit(idx)}
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">
                    Total:{' '}
                    {splits
                      .reduce((sum, s) => sum + (parseFloat(s.porcentagem) || 0), 0)
                      .toFixed(0)}
                    %
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className={`flex-1 rounded-xl px-6 py-3 text-sm font-semibold text-white transition ${
                tipo === 'entrada'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50`}
            >
              {submitLoading
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar alterações'
                  : 'Salvar transação'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default memo(FinanceiroNovaTransacaoModal);
