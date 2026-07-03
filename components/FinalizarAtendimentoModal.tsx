'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Sparkles, AlertCircle, Phone } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { format, isAfter, parseISO, startOfDay } from 'date-fns';
import MedicoSelect from '@/components/MedicoSelect';
import {
  defaultMedicoFromList,
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import PacienteSearchField from '@/components/PacienteSearchField';
import type { PacienteOpcao } from '@/lib/types';
import { parsePacienteSel } from '@/lib/pacienteOpcoesUi';
import {
  FORMAS_PAGAMENTO_ATENDIMENTO,
  type FormaPagamentoAtendimento,
  calcularValorAtendimento,
} from '@/lib/atendimentoFinalizar';
import { formatCurrency, aplicarMascaraWhatsapp, mascaraTelefoneInput, PHONE_INTL_HINT, phoneInputPlaceholder } from '@/lib/constants';
import { isInternationalPhoneInput, isValidPhone } from '@/lib/phoneMatch';
import { useLembretesSettings } from '@/lib/useLembretesSettings';
import { formatLembretesDashboardHint } from '@/lib/lembretesCopy';
import AnamnesePublicFields from '@/components/AnamnesePublicFields';
import type { AnamneseCampo } from '@/lib/anamnese';
import AtendimentoItensEditor from '@/components/AtendimentoItensEditor';
import type { AtendimentoItemLinha } from '@/lib/atendimentoItens';
import { calcularTotalItens } from '@/lib/atendimentoItens';

export type FinalizarAtendimentoPayload = {
  nome: string;
  clienteId?: string | null;
  pacienteSel?: string;
  telefone: string;
  lembretesWhatsapp: boolean;
  data: string;
  hora: string;
  valorPago: number;
  valorOriginal: number;
  formaPagamento: FormaPagamentoAtendimento;
  medico: string;
  percentualProfissional: number;
  descontoPercent: number;
  descontoValor: number;
  parcelas: number;
  tipo: 'consulta';
  observacoes: string;
  catalogoItens: AtendimentoItemLinha[];
  anamneseRespostas: Record<string, string | boolean>;
};

type FieldErrors = Partial<Record<
  | 'paciente'
  | 'nome'
  | 'telefone'
  | 'data'
  | 'hora'
  | 'medico'
  | 'percentual'
  | 'valor'
  | 'formaPagamento'
  | 'parcelas',
  string
>>;

type FinalizarAtendimentoModalProps = {
  onClose: () => void;
  onConfirm: (payload: FinalizarAtendimentoPayload) => void | Promise<void>;
  clienteId?: string | null;
  nomeInicial?: string;
  telefoneInicial?: string;
  medicoInicial?: string;
  /** Lista já carregada na tela Clientes (exibe na hora enquanto busca Google). */
  clientesIniciais?: PacienteOpcao[];
  isClinica?: boolean;
  medicos?: string[];
  valorInicial?: number;
  /** Quando definido, oculta busca de cliente (já selecionado na ficha). */
  clienteFixo?: boolean;
  saving?: boolean;
  erroEnvio?: string | null;
};

function applyPacienteFromOpcao(
  opt: PacienteOpcao,
  setters: {
    setNome: (v: string) => void;
    setResolvedClienteId: (v: string | null) => void;
    setFieldErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  },
) {
  if (opt.origem === 'google' || opt.id.startsWith('g:')) return;
  const { driveId } = parsePacienteSel(opt.id);
  setters.setResolvedClienteId(driveId);
  setters.setNome(opt.nome);
  setters.setFieldErrors((f) => ({
    ...f,
    paciente: undefined,
    nome: undefined,
    telefone: undefined,
  }));
}

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
  }`;
}

export default function FinalizarAtendimentoModal({
  onClose,
  onConfirm,
  clienteId = null,
  nomeInicial = '',
  telefoneInicial = '',
  medicoInicial = '',
  clientesIniciais = [],
  isClinica = false,
  medicos = [],
  valorInicial = 200,
  clienteFixo = false,
  saving = false,
  erroEnvio = null,
}: FinalizarAtendimentoModalProps) {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const agora = format(new Date(), 'HH:mm');

  const [pacienteSel, setPacienteSel] = useState(() =>
    clienteId ? `d:${clienteId}` : '',
  );

  const [nome, setNome] = useState(nomeInicial);
  const [telefone, setTelefone] = useState(
    telefoneInicial ? aplicarMascaraWhatsapp(telefoneInicial) : '',
  );
  const [resolvedClienteId, setResolvedClienteId] = useState<string | null>(clienteId);
  const [data, setData] = useState(hoje);
  const [hora, setHora] = useState(agora);
  const [valorOriginal, setValorOriginal] = useState(String(valorInicial));
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoAtendimento>('pix');
  const [medico, setMedico] = useState(
    medicoInicial || defaultMedicoFromList(medicos),
  );
  const [percentualProfissional, setPercentualProfissional] = useState('50');
  const [descontoPercent, setDescontoPercent] = useState('');
  const [descontoValor, setDescontoValor] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [observacoesAtendimento, setObservacoesAtendimento] = useState('');
  const [catalogoItens, setCatalogoItens] = useState<AtendimentoItemLinha[]>([]);
  const [valorManual, setValorManual] = useState(false);
  const [anamneseCampos, setAnamneseCampos] = useState<AnamneseCampo[]>([]);
  const [anamneseValues, setAnamneseValues] = useState<Record<string, string | boolean>>({});
  const [preencherFicha, setPreencherFicha] = useState(false);
  const [lembretesWhatsapp, setLembretesWhatsapp] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [telefoneEditadoPeloUsuario, setTelefoneEditadoPeloUsuario] = useState(false);
  const lembretesSettings = useLembretesSettings();

  function onSelectPaciente(sel: string, opt: PacienteOpcao | null) {
    setPacienteSel(sel);
    setTelefoneEditadoPeloUsuario(false);
    if (!sel || !opt) {
      setResolvedClienteId(null);
      return;
    }
    applyPacienteFromOpcao(opt, {
      setNome,
      setResolvedClienteId,
      setFieldErrors,
    });
  }

  const valorCalculado = useMemo(
    () =>
      calcularValorAtendimento(
        Number(valorOriginal) || 0,
        Number(descontoPercent) || 0,
        Number(descontoValor) || 0,
      ),
    [valorOriginal, descontoPercent, descontoValor],
  );

  const valorParcela =
    Number(parcelas) > 1 ? valorCalculado / Number(parcelas) : valorCalculado;

  const dataFutura = useMemo(() => {
    try {
      return isAfter(parseISO(data), startOfDay(new Date()));
    } catch {
      return false;
    }
  }, [data]);

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
    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, scrollY);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const onTotalItensChange = useCallback((total: number) => {
    if (total > 0 && !valorManual) {
      setValorOriginal(String(total));
    }
  }, [valorManual]);

  useEffect(() => {
    fetch('/api/config/anamnese')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.campos)) setAnamneseCampos(d.campos);
      })
      .catch(() => setAnamneseCampos([]));
  }, []);

  function validarTelefone(value: string): string | null {
    if (!isValidPhone(value)) {
      return 'Informe o WhatsApp com DDD ou internacional (+código do país)';
    }
    return null;
  }

  function validar(): FieldErrors {
    const errs: FieldErrors = {};
    const nomeTrim = nome.trim();

    if (!clienteFixo && !pacienteSel && nomeTrim.length < 2) {
      errs.paciente = 'Selecione um cliente na lista';
      errs.nome = 'Informe o nome do cliente';
    }

    const telErr = validarTelefone(telefone);
    if (telErr) errs.telefone = telErr;

    if (!data) errs.data = 'Informe a data';
    if (!hora) errs.hora = 'Informe a hora';

    const medicoErr = validateMedicoSelection(medicos, medico, isClinica);
    if (medicoErr) errs.medico = medicoErr;

    const pct = Number(percentualProfissional);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      errs.percentual = 'Informe a comissão entre 0 e 100%';
    }

    const valorNum = Number(valorOriginal);
    if (formaPagamento !== 'permuta' && (!valorOriginal || valorNum <= 0)) {
      errs.valor = 'Informe o valor do atendimento';
    }
    if (valorCalculado <= 0 && formaPagamento !== 'permuta') {
      errs.valor = 'Valor final deve ser maior que zero';
    }
    if (!formaPagamento) errs.formaPagamento = 'Selecione a forma de pagamento';
    if (!parcelas || Number(parcelas) < 1) errs.parcelas = 'Selecione o parcelamento';

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validar();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const medicoFinal = resolveMedicoValue(medicos, medico);

    await onConfirm({
      nome: nome.trim() || nomeInicial,
      clienteId: resolvedClienteId,
      pacienteSel,
      telefone: telefone.trim(),
      lembretesWhatsapp,
      data,
      hora,
      valorPago: valorCalculado,
      valorOriginal: Number(valorOriginal) || 0,
      formaPagamento,
      medico: medicoFinal,
      percentualProfissional: Number(percentualProfissional) || 0,
      descontoPercent: Number(descontoPercent) || 0,
      descontoValor: Number(descontoValor) || 0,
      parcelas: Math.max(1, Number(parcelas) || 1),
      tipo: 'consulta',
      observacoes: observacoesAtendimento.trim(),
      catalogoItens: catalogoItens.filter((i) => i.catalogoId),
      anamneseRespostas: preencherFicha ? anamneseValues : {},
    });
  }

  const temErros = Object.keys(fieldErrors).length > 0 || !!erroEnvio;

  useBodyScrollLock(true);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] sm:max-h-[92vh] flex flex-col overflow-hidden overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Atendimento avulso</h2>
            <p className="text-xs text-gray-500 mt-0.5">Lançar atendimento</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4"
          noValidate
        >
          {temErros && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                {erroEnvio && (
                  <p className="font-medium">
                    {typeof erroEnvio === 'string' ? erroEnvio : 'Erro ao finalizar atendimento'}
                  </p>
                )}
                {Object.keys(fieldErrors).length > 0 && (
                  <p className={erroEnvio ? 'mt-1' : ''}>
                    Preencha todos os campos obrigatórios antes de confirmar.
                  </p>
                )}
              </div>
            </div>
          )}

          {clienteFixo ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">Cliente</p>
              <p className="font-medium text-gray-900">{nomeInicial || nome}</p>
            </div>
          ) : (
            <PacienteSearchField
              value={pacienteSel}
              onChange={onSelectPaciente}
              onTelefoneChange={(tel) => {
                setTelefone(tel);
                setFieldErrors((f) => ({ ...f, telefone: undefined }));
              }}
              telefoneAtual={telefone}
              telefoneEditadoPeloUsuario={telefoneEditadoPeloUsuario}
              clientesIniciais={clientesIniciais}
              preselectDriveId={clienteId}
              error={fieldErrors.paciente}
              manualName={nome}
              onManualNameChange={(n) => {
                setNome(n);
                if (fieldErrors.nome) setFieldErrors((f) => ({ ...f, nome: undefined }));
              }}
              manualNameError={fieldErrors.nome}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp (DDD) *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={telefone}
                onChange={(e) => {
                  setTelefoneEditadoPeloUsuario(true);
                  setTelefone(mascaraTelefoneInput(e.target.value, telefone));
                  if (fieldErrors.telefone) setFieldErrors((f) => ({ ...f, telefone: undefined }));
                }}
                placeholder={phoneInputPlaceholder(telefone)}
                className={`w-full rounded-xl border pl-10 pr-4 py-3 text-sm ${
                  fieldErrors.telefone ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
            </div>
            {fieldErrors.telefone && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.telefone}</p>
            )}
            {isInternationalPhoneInput(telefone) && (
              <p className="text-xs text-gray-500 mt-1">{PHONE_INTL_HINT}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              O mesmo número unifica agenda, lembretes e cadastro — evita duplicar o cliente.
            </p>
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lembretesWhatsapp}
                onChange={(e) => setLembretesWhatsapp(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
              />
              <span className="text-xs text-gray-600 leading-snug">
                Incluir nos lembretes do Dashboard (
                {formatLembretesDashboardHint(lembretesSettings)} da sessão)
                {dataFutura ? '' : ' — recomendado para datas futuras'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                value={data}
                onChange={(e) => {
                  setData(e.target.value);
                  if (fieldErrors.data) setFieldErrors((f) => ({ ...f, data: undefined }));
                }}
                className={inputClass(!!fieldErrors.data)}
              />
              {fieldErrors.data && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.data}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => {
                  setHora(e.target.value);
                  if (fieldErrors.hora) setFieldErrors((f) => ({ ...f, hora: undefined }));
                }}
                className={inputClass(!!fieldErrors.hora)}
              />
              {fieldErrors.hora && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.hora}</p>
              )}
            </div>
          </div>

          <MedicoSelect
            medicos={medicos}
            isClinica={isClinica}
            value={medico}
            onChange={(v) => {
              setMedico(v);
              if (fieldErrors.medico) setFieldErrors((f) => ({ ...f, medico: undefined }));
            }}
            error={fieldErrors.medico}
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
              onChange={(e) => {
                setPercentualProfissional(e.target.value);
                if (fieldErrors.percentual) {
                  setFieldErrors((f) => ({ ...f, percentual: undefined }));
                }
              }}
              className={inputClass(!!fieldErrors.percentual)}
            />
            {fieldErrors.percentual && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.percentual}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Percentual sobre o valor líquido (após taxa do meio de pagamento, se configurado).
            </p>
          </div>

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
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              placeholder="Descreva o que foi realizado no atendimento..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorOriginal}
              onChange={(e) => {
                setValorManual(true);
                setValorOriginal(e.target.value);
                if (fieldErrors.valor) setFieldErrors((f) => ({ ...f, valor: undefined }));
              }}
              className={inputClass(!!fieldErrors.valor)}
            />
            {catalogoItens.some((i) => i.catalogoId) && (
              <p className="text-xs text-gray-500 mt-1">
                Subtotal dos itens: {formatCurrency(calcularTotalItens(catalogoItens))} — edite se
                precisar de outro valor.
              </p>
            )}
            {fieldErrors.valor && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.valor}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={descontoPercent}
                onChange={(e) => setDescontoPercent(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={descontoValor}
                onChange={(e) => setDescontoValor(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parcelamento *</label>
            <select
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              className={inputClass(!!fieldErrors.parcelas)}
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
              Forma de pagamento *
            </label>
            <select
              value={formaPagamento}
              onChange={(e) =>
                setFormaPagamento(e.target.value as FormaPagamentoAtendimento)
              }
              className={inputClass(!!fieldErrors.formaPagamento)}
            >
              {FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {anamneseCampos.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preencherFicha}
                  onChange={(e) => {
                    setPreencherFicha(e.target.checked);
                    if (!e.target.checked) setAnamneseValues({});
                  }}
                  className="mt-0.5 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
                />
                <span className="text-sm text-gray-700 leading-snug">
                  Preencher ficha do cliente (opcional)
                </span>
              </label>
              {preencherFicha && (
                <AnamnesePublicFields
                  campos={anamneseCampos}
                  values={anamneseValues}
                  optional
                  onChange={(id, value) =>
                    setAnamneseValues((prev) => ({ ...prev, [id]: value }))
                  }
                />
              )}
            </div>
          )}

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
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
