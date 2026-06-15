'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import MedicoSelect from '@/components/MedicoSelect';
import AtendimentoItensEditor from '@/components/AtendimentoItensEditor';
import type { ClienteAtendimento } from '@/lib/types';
import {
  ATENDIMENTO_LABEL,
  FORMAS_PAGAMENTO,
  STATUS_ATENDIMENTO,
  formatCurrency,
} from '@/lib/constants';
import {
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import {
  type AtendimentoItemLinha,
  calcularTotalItens,
  parseObservacaoAtendimento,
} from '@/lib/atendimentoItens';

export type EditarAtendimentoPayload = {
  data: string;
  hora: string | null;
  medico: string | null;
  valor: number | null;
  status: string;
  observacoes: string;
  catalogoItens: AtendimentoItemLinha[];
  formaPagamento: string | null;
};

type Props = {
  atendimento: ClienteAtendimento;
  formaPagamentoInicial?: string | null;
  medicos: string[];
  isClinica?: boolean;
  saving?: boolean;
  erroEnvio?: string | null;
  onClose: () => void;
  onConfirm: (payload: EditarAtendimentoPayload) => void | Promise<void>;
};

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
  }`;
}

export default function EditarAtendimentoModal({
  atendimento,
  formaPagamentoInicial = null,
  medicos,
  isClinica = false,
  saving = false,
  erroEnvio = null,
  onClose,
  onConfirm,
}: Props) {
  const parsedInicial = useMemo(
    () => parseObservacaoAtendimento(atendimento.observacoes),
    [atendimento.observacoes],
  );

  const [data, setData] = useState(atendimento.data);
  const [hora, setHora] = useState(atendimento.hora ?? '');
  const [medico, setMedico] = useState(atendimento.medico ?? '');
  const [valor, setValor] = useState(
    atendimento.valor != null ? String(atendimento.valor) : '',
  );
  const [status, setStatus] = useState(atendimento.status);
  const [observacoes, setObservacoes] = useState(parsedInicial.textoLivre);
  const [catalogoItens, setCatalogoItens] = useState<AtendimentoItemLinha[]>(parsedInicial.itens);
  const [formaPagamento, setFormaPagamento] = useState(formaPagamentoInicial ?? '');
  const [valorManual, setValorManual] = useState(false);
  const [medicoErro, setMedicoErro] = useState<string | undefined>();
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const onTotalItensChange = useCallback(
    (total: number) => {
      if (total > 0 && !valorManual) {
        setValor(String(total));
      }
    },
    [valorManual],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroLocal(null);

    const medicoErr = validateMedicoSelection(medicos, medico, isClinica);
    if (medicoErr) {
      setMedicoErro(medicoErr);
      return;
    }
    setMedicoErro(undefined);

    if (!data) {
      setErroLocal('Informe a data do atendimento');
      return;
    }

    const valorNum =
      valor.trim() !== ''
        ? Number(valor)
        : catalogoItens.some((i) => i.catalogoId)
          ? calcularTotalItens(catalogoItens)
          : null;

    await onConfirm({
      data,
      hora: hora.trim() || null,
      medico: resolveMedicoValue(medicos, medico) || null,
      valor: valorNum,
      status,
      observacoes: observacoes.trim(),
      catalogoItens: catalogoItens.filter((i) => i.catalogoId),
      formaPagamento: formaPagamento || null,
    });
  }

  const erro = erroEnvio || erroLocal;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Editar atendimento</h2>
            <p className="text-xs text-gray-500 mt-0.5">Altere serviços, valores e profissional</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
          {erro && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{erro}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className={inputClass(false)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={inputClass(false)}
              />
            </div>
          </div>

          <MedicoSelect
            medicos={medicos}
            isClinica={isClinica}
            value={medico}
            onChange={(v) => {
              setMedico(v);
              setMedicoErro(undefined);
            }}
            error={medicoErro}
            label="Profissional"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ClienteAtendimento['status'])}
              className={inputClass(false)}
            >
              {STATUS_ATENDIMENTO.map((s) => (
                <option key={s} value={s}>
                  {ATENDIMENTO_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <AtendimentoItensEditor
            itens={catalogoItens}
            onChange={setCatalogoItens}
            onTotalChange={onTotalItensChange}
            disabled={saving}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => {
                setValorManual(true);
                setValor(e.target.value);
              }}
              className={inputClass(false)}
            />
            {catalogoItens.some((i) => i.catalogoId) && (
              <p className="text-xs text-gray-500 mt-1">
                Subtotal dos itens: {formatCurrency(calcularTotalItens(catalogoItens))}
              </p>
            )}
          </div>

          {formaPagamentoInicial != null && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma de pagamento
              </label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className={inputClass(false)}
              >
                <option value="">—</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {ATENDIMENTO_LABEL[f]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              placeholder="Detalhes do atendimento..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#047482] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#035e6b] disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
