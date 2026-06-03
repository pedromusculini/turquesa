'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import ConvenioSelect from '@/components/ConvenioSelect';
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
  classificarTipoConsulta,
  calcularValorComDesconto,
  TIPO_CONSULTA_UI,
  formatHorario,
  DIAS_RETORNO,
} from '@/lib/consultations';
import { formatCurrency } from '@/lib/constants';

type FinalizarConsultaModalProps = {
  consulta: ConsultationRecord;
  allEvents: ConsultationRecord[];
  medicos?: string[];
  isClinica?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    valorPago: number;
    valorOriginal: number;
    formaPagamento: FormaPagamentoConsulta;
    convenio: string;
    descontoPercent: number;
    descontoValor: number;
    parcelas: number;
    tipoConsulta: 'nova_consulta' | 'retorno';
    medico: string;
  }) => void;
};

export default function FinalizarConsultaModal({
  consulta,
  allEvents,
  medicos = [],
  isClinica = false,
  onClose,
  onConfirm,
}: FinalizarConsultaModalProps) {
  const dataConsulta = useMemo(() => {
    const start = consulta.start;
    if (typeof start === 'string') return new Date(start);
    if (start instanceof Date) return start;
    return new Date();
  }, [consulta.start]);

  const tipoAuto = useMemo(
    () =>
      consulta.patient
        ? classificarTipoConsulta(allEvents, consulta.patient, dataConsulta)
        : 'nova_consulta',
    [allEvents, consulta.patient, dataConsulta],
  );

  const [valorOriginal, setValorOriginal] = useState(String(consulta.value ?? 200));
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoConsulta>('pix');
  const [convenio, setConvenio] = useState(consulta.convenio ?? '');
  const [descontoPercent, setDescontoPercent] = useState('');
  const [descontoValor, setDescontoValor] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [tipoManual, setTipoManual] = useState<'auto' | 'nova_consulta' | 'retorno'>('auto');
  const [medico, setMedico] = useState(
    consulta.medico ?? defaultMedicoFromList(medicos),
  );
  const [medicoError, setMedicoError] = useState<string | undefined>();

  const tipoFinal =
    tipoManual === 'auto' ? tipoAuto : tipoManual;

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
    onConfirm({
      valorPago: valorCalculado,
      valorOriginal: Number(valorOriginal) || 0,
      formaPagamento,
      convenio,
      descontoPercent: Number(descontoPercent) || 0,
      descontoValor: Number(descontoValor) || 0,
      parcelas: Math.max(1, Number(parcelas) || 1),
      tipoConsulta: tipoFinal,
      medico: resolveMedicoValue(medicos, medico),
    });
  }

  const tipoUi = TIPO_CONSULTA_UI[tipoFinal];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Finalizar consulta</h2>
            <p className="text-sm text-gray-500">
              {consulta.patient} · {formatHorario(consulta)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Tipo consulta / retorno */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-800">Tipo de atendimento</p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tipoUi.color}`}>
                {tipoUi.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 flex items-start gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Regra automática: retorno se o paciente já foi atendido nos últimos {DIAS_RETORNO}{' '}
              dias; caso contrário, nova consulta.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'auto', label: `Automático (${TIPO_CONSULTA_UI[tipoAuto].label})` },
                  { id: 'nova_consulta', label: 'Forçar: Nova consulta' },
                  { id: 'retorno', label: 'Forçar: Retorno' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTipoManual(opt.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    tipoManual === opt.id
                      ? 'border-[#228B22] bg-green-50 text-[#228B22]'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
            label="Médico"
          />

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor da consulta (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorOriginal}
              onChange={(e) => setValorOriginal(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              required
            />
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

          {/* Convênio */}
          <ConvenioSelect
            value={convenio}
            onChange={setConvenio}
            label="Plano / convênio do paciente"
            allowEmpty
            emptyLabel="Particular ou não informado"
          />

          {/* Resumo */}
          <div className="rounded-xl bg-[#013a01] text-white p-4 space-y-1">
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
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[#013a01] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#025201]"
            >
              <CheckCircle2 className="w-5 h-5" />
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
