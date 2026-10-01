'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Sparkles, Package } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import AtendimentoItensEditor, {
  fetchPrefillItensFromService,
} from '@/components/AtendimentoItensEditor';
import type { AtendimentoItemLinha } from '@/lib/atendimentoItens';
import { calcularTotalItens } from '@/lib/atendimentoItens';
import MedicoSelect from '@/components/MedicoSelect';
import PacoteSessaoSelector from '@/components/PacoteSessaoSelector';
import VenderPacoteFields, {
  postVenderPacote,
  type VenderPacoteFieldsHandle,
} from '@/components/VenderPacoteFields';
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
import CurrencyInput from '@/components/CurrencyInput';
import { formatValorBRLInput, parseValorBRL } from '@/lib/moeda';

type CobrarModo = 'normal' | 'usar_pacote' | 'vender_pacote';

type FinalizarConsultaModalProps = {
  consulta: ConsultationRecord;
  medicos?: string[];
  isClinica?: boolean;
  saving?: boolean;
  /** Só para fixtures de UI — abre já no modo vender pacote. */
  initialCobrarModo?: CobrarModo;
  /** Prefill do formulário de venda (fixtures). */
  venderPacoteInitialValues?: Partial<{
    nome: string;
    sessoes: string;
    sessoesJaUsadas: string;
    valor: string;
  }>;
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
    pacoteId?: string | null;
    /** true quando a venda do pacote já registrou o financeiro. */
    pacoteVendidoAgora?: boolean;
  }) => void;
};

export default function FinalizarConsultaModal({
  consulta,
  medicos = [],
  isClinica = false,
  saving = false,
  initialCobrarModo = 'normal',
  venderPacoteInitialValues,
  onClose,
  onConfirm,
}: FinalizarConsultaModalProps) {
  const venderRef = useRef<VenderPacoteFieldsHandle>(null);
  const [valorOriginal, setValorOriginal] = useState(
    formatValorBRLInput(consulta.value ?? 200),
  );
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
  const [pacoteId, setPacoteId] = useState<string | null>(null);
  const [cobrarModo, setCobrarModo] = useState<CobrarModo>(initialCobrarModo);
  const [vendaError, setVendaError] = useState<string | null>(null);
  const [vendendoPacote, setVendendoPacote] = useState(false);
  const [valorPacotePreview, setValorPacotePreview] = useState(0);
  const [venderNovoTambem, setVenderNovoTambem] = useState(false);
  const [pacoteVendidoId, setPacoteVendidoId] = useState<string | null>(null);

  const clienteId = consulta.clienteDriveId ?? null;
  const busy = saving || vendendoPacote;
  const mostrarVenda = cobrarModo === 'vender_pacote' || venderNovoTambem;

  const valorCalculado = useMemo(() => {
    const base = parseValorBRL(valorOriginal);
    return calcularValorComDesconto(
      base,
      Number(descontoPercent) || 0,
      parseValorBRL(descontoValor),
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
    setPacoteId(null);
    setCobrarModo(initialCobrarModo);
    setVendaError(null);
    setValorPacotePreview(0);
    setVenderNovoTambem(false);
    setPacoteVendidoId(null);
    void fetchPrefillItensFromService(consulta.service, consulta.catalogoItens).then(
      (prefill) => {
        setCatalogoItens(prefill);
        const totalItens = calcularTotalItens(prefill);
        if (totalItens > 0) {
          setValorOriginal(formatValorBRLInput(totalItens));
        } else {
          setValorOriginal(formatValorBRLInput(consulta.value ?? 200));
        }
      },
    );
  }, [consulta.id]);

  const onTotalItensChange = useCallback((total: number) => {
    if (total > 0 && !valorManual) {
      setValorOriginal(formatValorBRLInput(total));
    }
  }, [valorManual]);

  function setModo(modo: CobrarModo) {
    setCobrarModo(modo);
    setVendaError(null);
    if (modo !== 'usar_pacote') setPacoteId(null);
    if (modo === 'vender_pacote') setVenderNovoTambem(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const medicoErr = validateMedicoSelection(medicos, medico, isClinica);
    if (medicoErr) {
      setMedicoError(medicoErr);
      return;
    }
    setMedicoError(undefined);

    const pct = Number(percentualProfissional);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      alert('Informe a comissão entre 0 e 100%.');
      return;
    }
    const itensValidos = catalogoItens.filter((i) => i.catalogoId);
    const medicoFinal = resolveMedicoValue(medicos, medico);

    if (cobrarModo === 'usar_pacote' && !pacoteId) {
      alert('Selecione o pacote que será usado neste atendimento.');
      return;
    }
    if (cobrarModo === 'normal' && valorCalculado <= 0 && formaPagamento !== 'permuta') {
      alert('Informe o valor pago.');
      return;
    }

    async function garantirPacoteVendido(): Promise<string | null> {
      if (pacoteVendidoId) return pacoteVendidoId;
      if (!clienteId) {
        setVendaError(
          'Vincule a cliente na ficha (Google Drive) para vender o pacote neste fechamento.',
        );
        return null;
      }
      const err = venderRef.current
        ? venderRef.current.validate()
        : 'Preencha os dados do pacote.';
      if (err) {
        setVendaError(err);
        return null;
      }
      setVendendoPacote(true);
      setVendaError(null);
      try {
        const body = venderRef.current!.toApiBody();
        if (!body.medico && medicoFinal) body.medico = medicoFinal;
        body.percentual_profissional = pct;
        const { pacote } = await postVenderPacote(clienteId, body);
        setPacoteVendidoId(pacote.id);
        return pacote.id;
      } catch (err) {
        setVendaError(err instanceof Error ? err.message : 'Erro ao vender pacote');
        return null;
      } finally {
        setVendendoPacote(false);
      }
    }

    let novoPacoteId: string | null = null;
    if (mostrarVenda) {
      novoPacoteId = await garantirPacoteVendido();
      if (!novoPacoteId) return;
    }

    const base = {
      tipoConsulta: 'nova_consulta' as const,
      medico: medicoFinal,
      percentualProfissional: pct,
      observacoes: observacoesAtendimento.trim(),
      catalogoItens: itensValidos,
      pacoteVendidoAgora: mostrarVenda || undefined,
    };
    const semCobranca = {
      valorPago: 0,
      valorOriginal: 0,
      formaPagamento: 'pacote' as const,
      descontoPercent: 0,
      descontoValor: 0,
      parcelas: 1,
    };

    if (cobrarModo === 'vender_pacote') {
      onConfirm({ ...base, ...semCobranca, pacoteId: novoPacoteId });
      return;
    }
    if (cobrarModo === 'usar_pacote') {
      onConfirm({ ...base, ...semCobranca, pacoteId });
      return;
    }
    onConfirm({
      ...base,
      valorPago: valorCalculado,
      valorOriginal: parseValorBRL(valorOriginal),
      formaPagamento,
      descontoPercent: Number(descontoPercent) || 0,
      descontoValor: parseValorBRL(descontoValor),
      parcelas: Math.max(1, Number(parcelas) || 1),
      pacoteId: null,
    });
  }

  useBodyScrollLock(true);

  if (typeof document === 'undefined') return null;

  const valorAtendimento = cobrarModo === 'normal' ? valorCalculado : 0;
  const valorPacoteNovo = mostrarVenda ? valorPacotePreview : 0;
  const totalReceber = valorAtendimento + valorPacoteNovo;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] sm:max-h-[92vh] flex flex-col overflow-hidden overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
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

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-5"
          noValidate
        >
          <AtendimentoItensEditor
            itens={catalogoItens}
            onChange={setCatalogoItens}
            onTotalChange={onTotalItensChange}
            disabled={busy}
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

          <div className="rounded-xl border border-[#047482]/25 bg-[#eef4f5] p-3 space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Package className="h-4 w-4 text-[#047482]" aria-hidden />
              Como cobrar
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="cobrar-modo"
                checked={cobrarModo === 'normal'}
                onChange={() => setModo('normal')}
                disabled={busy}
                className="mt-0.5"
              />
              <span>Cobrar este atendimento</span>
            </label>
            {clienteId && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="cobrar-modo"
                  checked={cobrarModo === 'usar_pacote'}
                  onChange={() => setModo('usar_pacote')}
                  disabled={busy}
                  className="mt-0.5"
                />
                <span>Usar sessão de pacote já vendido</span>
              </label>
            )}
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="cobrar-modo"
                checked={cobrarModo === 'vender_pacote'}
                onChange={() => setModo('vender_pacote')}
                disabled={busy}
                className="mt-0.5"
              />
              <span>
                Vender pacote novo e usar 1 sessão nele
                <span className="block text-xs font-normal text-gray-500">
                  Este atendimento já conta como sessão do pacote novo
                </span>
              </span>
            </label>
            {cobrarModo !== 'vender_pacote' && (
              <label className="flex items-start gap-2 border-t border-[#047482]/15 pt-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={venderNovoTambem}
                  onChange={(e) => {
                    setVenderNovoTambem(e.target.checked);
                    setVendaError(null);
                  }}
                  disabled={busy}
                  className="mt-0.5 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
                />
                <span>
                  Vender também um pacote novo
                  <span className="block text-xs font-normal text-gray-500">
                    Ex.: o pacote anterior terminou hoje. O novo começa do zero e este
                    atendimento não desconta dele.
                  </span>
                </span>
              </label>
            )}
          </div>

          {cobrarModo === 'usar_pacote' && (
            <PacoteSessaoSelector
              clienteId={clienteId}
              value={pacoteId}
              onChange={setPacoteId}
              disabled={busy}
              hideCobrarNormal
            />
          )}

          {cobrarModo === 'normal' && (
          <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor do atendimento (R$)
            </label>
            <CurrencyInput
              value={valorOriginal}
              onChange={(v) => {
                setValorManual(true);
                setValorOriginal(v);
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
              <CurrencyInput
                value={descontoValor}
                onChange={setDescontoValor}
                placeholder="0,00"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

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
          </>
          )}

          {mostrarVenda && (
            <div className="rounded-xl border border-[#047482]/20 bg-gray-50 p-3 space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Package className="h-4 w-4 text-[#047482]" aria-hidden />
                Pacote novo
              </p>
              {!clienteId ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Esta sessão ainda não tem cliente vinculada no Drive. Abra a ficha e vincule
                  antes de vender o pacote no fechamento.
                </p>
              ) : pacoteVendidoId ? (
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Pacote já registrado. Falta só concluir o atendimento.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-600">
                    {cobrarModo === 'vender_pacote'
                      ? 'Informe o pacote e quantas sessões já tinham sido feitas. O sistema desconta este atendimento automaticamente.'
                      : 'Pacote vendido agora. Deixe "Sessões já feitas" em 0 se ele começa do zero.'}
                  </p>
                  <VenderPacoteFields
                    ref={venderRef}
                    medicos={medicos}
                    reservarSessaoAtual={cobrarModo === 'vender_pacote'}
                    medicoInicial={resolveMedicoValue(medicos, medico)}
                    percentualProfissional={Number(percentualProfissional) || 0}
                    disabled={busy}
                    compact
                    initialValues={venderPacoteInitialValues}
                    onDraftChange={(d) => setValorPacotePreview(d.valorTotal)}
                  />
                </>
              )}
              {vendaError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {vendaError}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl bg-[#047482] text-white p-4 space-y-1">
            <p className="text-sm text-green-100 flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              {cobrarModo === 'vender_pacote'
                ? 'Total do pacote'
                : cobrarModo === 'usar_pacote' && !mostrarVenda
                  ? 'Sessão do pacote'
                  : 'Total a receber'}
            </p>
            <p className="text-2xl font-bold">{formatCurrency(totalReceber)}</p>
            {cobrarModo === 'vender_pacote' && (
              <p className="text-xs text-green-200">
                Entra no financeiro na venda do pacote · atendimento sem cobrança extra
              </p>
            )}
            {cobrarModo === 'usar_pacote' && (
              <p className="text-xs text-green-200">
                {mostrarVenda
                  ? `Pacote novo ${formatCurrency(valorPacoteNovo)} · este atendimento usa o pacote anterior`
                  : 'Já pago no pacote · sem nova entrada no financeiro'}
              </p>
            )}
            {cobrarModo === 'normal' && mostrarVenda && (
              <p className="text-xs text-green-200">
                Atendimento {formatCurrency(valorAtendimento)} + pacote novo{' '}
                {formatCurrency(valorPacoteNovo)}
              </p>
            )}
            {cobrarModo === 'normal' && Number(parcelas) > 1 && (
              <p className="text-xs text-green-200">
                Atendimento em {parcelas}x de {formatCurrency(valorParcela)}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-[#047482] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#035e6b] disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              {vendendoPacote
                ? 'Vendendo pacote...'
                : saving
                  ? 'Salvando...'
                  : mostrarVenda && !pacoteVendidoId
                    ? 'Vender e finalizar'
                    : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
