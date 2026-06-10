'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, Sparkles } from 'lucide-react';
import AtendimentoItensEditor, {
  fetchPrefillItensFromService,
} from '@/components/AtendimentoItensEditor';
import type { AtendimentoItemLinha } from '@/lib/atendimentoItens';
import { calcularTotalItens } from '@/lib/atendimentoItens';
import MedicoSelect from '@/components/MedicoSelect';
import {
  defaultMedicoFromList,
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import {
  type ConsultationRecord,
  type FormaPagamentoConsulta,
  FORMAS_PAGAMENTO_CONSULTA,
  calcularValorComDesconto,
  formatHorario,
} from '@/lib/consultations';
import { formatCurrency } from '@/lib/constants';

type FinalizarConsultaModalProps = {
  consulta: ConsultationRecord;
  medicos?: string[];
  isClinica?: boolean;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    valorPago: number;
    valorOriginal: number;
    formaPagamento: FormaPagamentoConsulta;
    descontoPercent: number;
    descontoValor: number;
    parcelas: number;
    tipoConsulta: 'nova_consulta';
    medico: string;
    percentualProfissional: number;
    observacoes: string;
    catalogoItens: AtendimentoItemLinha[];
  }) => void;
};

export default function FinalizarConsultaModal({
  consulta,
  medicos = [],
  isClinica = false,
  saving = false,
  onClose,
  onConfirm,
}: FinalizarConsultaModalProps) {
  const [valorOriginal, setValorOriginal] = useState(String(consulta.value ?? 200));
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoConsulta>('pix');
  const [descontoPercent, setDescontoPercent] = useState('');
  const [descontoValor, setDescontoValor] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [medico, setMedico] = useState(
    consulta.medico ?? defaultMedicoFromList(medicos),
  );
  const [percentualProfissional, setPercentualProfissional] = useState('50');
  const [medicoError, setMedicoError] = useState<string | undefined>();
  const [catalogoItens, setCatalogoItens] = useState<AtendimentoItemLinha[]>([]);
  const [observacoesAtendimento, setObservacoesAtendimento] = useState(
    consulta.observacoes ?? '',
  );
  const [valorManual, setValorManual] = useState(false);

  const valorCalculado = useMemo(() => {
    const base = Number(valorOriginal) || 0;
    return calcularValorComDesconto(
      base,
      Number(descontoPercent) || 0,
      Number(descontoValor) || 0,
    );
  }, [valorOriginal, descontoPercent, descontoValor]);

  const valorParcela =
    Number(parcelas) > 1 ? valorCalculado / Number(parcelas) : valorCalculado;

  useEffect(() => {
    const nome = resolveMedicoValue(medicos, medico);
    if (!nome) return;
    fetch(`/api/financeiro/percentual-profissional?medico=${encodeURIComponent(nome)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.percentual != null) setPercentualProfissional(String(d.percentual));
      })
      .catch(() => {});
  }, [medico, medicos]);

  useEffect(() => {
    setObservacoesAtendimento(consulta.observacoes ?? '');
    setValorManual(false);
    void fetchPrefillItensFromService(consulta.service, consulta.catalogoItens).then(
      (prefill) => {
        setCatalogoItens(prefill);
        const totalItens = calcularTotalItens(prefill);
        if (totalItens > 0) {
          setValorOriginal(String(totalItens));
        } else {
          setValorOriginal(String(consulta.value ?? 200));
        }
      },
    );
  }, [consulta.id, consulta.service, consulta.catalogoItens, consulta.observacoes, consulta.value]);

  const onTotalItensChange = useCallback((total: number) => {
    if (total > 0 && !valorManual) {
      setValorOriginal(String(total));
    }
  }, [valorManual]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const medicoErr = validateMedicoSelection(medicos, medico, isClinica);
    if (medicoErr) {
      setMedicoError(medicoErr);
      return;
    }
    setMedicoError(undefined);
    if (valorCalculado <= 0 && formaPagamento !== 'permuta') {
      alert('Informe o valor pago.');
      return;
    }
    const pct = Number(percentualProfissional);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      alert('Informe a comissão entre 0 e 100%.');
      return;
    }
    const itensValidos = catalogoItens.filter((i) => i.catalogoId);

    onConfirm({
      valorPago: valorCalculado,
      valorOriginal: Number(valorOriginal) || 0,
      formaPagamento,
      descontoPercent: Number(descontoPercent) || 0,
      descontoValor: Number(descontoValor) || 0,
      parcelas: Math.max(1, Number(parcelas) || 1),
      tipoConsulta: 'nova_consulta',
      medico: resolveMedicoValue(medicos, medico),
      percentualProfissional: pct,
      observacoes: observacoesAtendimento.trim(),
      catalogoItens: itensValidos,
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Finalizar atendimento</h2>
            <p className="text-sm text-gray-500">
              {consulta.patient} · {formatHorario(consulta)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <AtendimentoItensEditor
            itens={catalogoItens}
            onChange={setCatalogoItens}
            onTotalChange={onTotalItensChange}
            disabled={saving}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              O que foi feito na cliente
            </label>
            <textarea
              value={observacoesAtendimento}
              onChange={(e) => setObservacoesAtendimento(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              placeholder="Descreva o que foi realizado no atendimento..."
            />
          </div>

          <MedicoSelect
            medicos={medicos}
            isClinica={isClinica}
            value={medico}
            onChange={(v) => {
              setMedico(v);
              setMedicoError(undefined);
            }}
            error={medicoError}
            label="Profissional"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comissão da profissional (%) *
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={percentualProfissional}
              onChange={(e) => setPercentualProfissional(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              required
            />
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor do atendimento (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorOriginal}
              onChange={(e) => {
                setValorManual(true);
                setValorOriginal(e.target.value);
              }}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              required
            />
            {catalogoItens.some((i) => i.catalogoId) && (
              <p className="text-xs text-gray-500 mt-1">
                Atualizado pelo subtotal dos itens — edite se precisar de outro valor.
              </p>
            )}
          </div>

          {/* Desconto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desconto (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={descontoPercent}
                onChange={(e) => setDescontoPercent(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desconto (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={descontoValor}
                onChange={(e) => setDescontoValor(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Parcelamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parcelamento
            </label>
            <select
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                <option key={n} value={String(n)}>
                  {n === 1 ? 'À vista (1x)' : `${n}x de ${formatCurrency(valorCalculado / n)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Forma pagamento - menu rolante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forma de pagamento
            </label>
            <select
              value={formaPagamento}
              onChange={(e) =>
                setFormaPagamento(e.target.value as FormaPagamentoConsulta)
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white"
              required
            >
              {FORMAS_PAGAMENTO_CONSULTA.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resumo */}
          <div className="rounded-xl bg-[#047482] text-white p-4 space-y-1">
            <p className="text-sm text-green-100 flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Total a receber
            </p>
            <p className="text-2xl font-bold">{formatCurrency(valorCalculado)}</p>
            {Number(parcelas) > 1 && (
              <p className="text-xs text-green-200">
                {parcelas}x de {formatCurrency(valorParcela)}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#047482] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#035e6b] disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
