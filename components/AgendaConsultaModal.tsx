'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, CalendarPlus, RotateCcw, AlertCircle, Phone, MessageCircle, Loader2 } from 'lucide-react';
import { MENSAGEM_TIPO_INFO } from '@/lib/mensagemTemplate';
import type { MensagemTipo } from '@/lib/mensagensWhatsapp';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { isMobileDevice, openWhatsAppUrl, preOpenExternalTab } from '@/lib/openExternalUrl';
import { format } from 'date-fns';
import MedicoSelect from '@/components/MedicoSelect';
import {
  defaultMedicoFromList,
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import PacienteSearchField from '@/components/PacienteSearchField';
import type { PacienteOpcao } from '@/lib/types';
import {
  fetchTelefoneClienteDrive,
  selFromDriveId,
  telefoneFromOpcao,
  telefonePreenchido,
} from '@/lib/pacienteOpcoesUi';
import { brPhoneLocalDigits } from '@/lib/phoneMatch';
import { ensurePacienteCliente } from '@/lib/ensurePacienteClienteClient';
import { Trash2 } from 'lucide-react';
import {
  classificarTipoConsulta,
  DIAS_RETORNO,
  DURACAO_CONSULTA_MIN,
  horaMaisMinutos,
  type ConsultationRecord,
} from '@/lib/consultations';
import { ATENDIMENTO_LABEL } from '@/lib/constants';
import { useLembretesSettings } from '@/lib/useLembretesSettings';
import { formatLembretesDashboardHint } from '@/lib/lembretesCopy';

export type AgendaConsultaPayload = {
  patient: string;
  service: string;
  start: Date;
  end: Date;
  value: number;
  location: string;
  convenio: string;
  medico: string;
  observacoes: string;
  telefone?: string;
  lembretesWhatsapp?: boolean;
  clienteDriveId?: string | null;
  pacienteSel?: string;
  editingId?: string | null;
};

type FieldErrors = Partial<
  Record<'patient' | 'data' | 'horaInicio' | 'horaFim' | 'medico' | 'telefone', string>
>;

type AgendaConsultaModalProps = {
  open: boolean;
  slotStart: Date;
  slotEnd: Date;
  editingEvent?: ConsultationRecord | null;
  allEvents: ConsultationRecord[];
  isClinica?: boolean;
  medicos?: string[];
  defaultLocation?: string;
  saving?: boolean;
  clientesIniciais?: PacienteOpcao[];
  initialClienteId?: string | null;
  onClose: () => void;
  onConfirm: (payload: AgendaConsultaPayload) => string | void | Promise<string | void>;
  onDelete?: () => void | Promise<void>;
  deleting?: boolean;
};

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
  }`;
}

export default function AgendaConsultaModal({
  open,
  slotStart,
  slotEnd,
  editingEvent = null,
  allEvents,
  isClinica = false,
  medicos = [],
  defaultLocation = '',
  saving = false,
  clientesIniciais = [],
  initialClienteId = null,
  onClose,
  onConfirm,
  onDelete,
  deleting = false,
}: AgendaConsultaModalProps) {
  const isEdit = !!editingEvent?.id;

  const [pacienteSel, setPacienteSel] = useState('');
  const [patient, setPatient] = useState('');
  const [service, setService] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [location, setLocation] = useState('');
  const [medico, setMedico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [telefone, setTelefone] = useState('');
  const [lembretesWhatsapp, setLembretesWhatsapp] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitErro, setSubmitErro] = useState<string | null>(null);
  const lembretesSettings = useLembretesSettings();
  const [whatsappPickerOpen, setWhatsappPickerOpen] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappPreview, setWhatsappPreview] = useState<string | null>(null);
  const [whatsappErro, setWhatsappErro] = useState<string | null>(null);
  const [savedConsultaId, setSavedConsultaId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const TEMPLATE_OPCOES: { tipo: MensagemTipo; label: string }[] = [
    {
      tipo: 'confirmacao_apos_agendar',
      label: MENSAGEM_TIPO_INFO.confirmacao_apos_agendar.titulo,
    },
    {
      tipo: 'lembrete_1_dia',
      label: MENSAGEM_TIPO_INFO.lembrete_1_dia.titulo,
    },
  ];

  const whatsappPronto =
    patient.trim().length >= 2 &&
    !!data &&
    !!horaInicio &&
    brPhoneLocalDigits(telefone).length >= 10;

  const onPacientePicked = useCallback((sel: string, opt: PacienteOpcao | null) => {
    setPacienteSel(sel);
    if (opt) {
      setPatient(opt.nome);
      const tel = telefoneFromOpcao(opt);
      if (tel) {
        setTelefone(tel);
      } else if (sel.startsWith('d:')) {
        void fetchTelefoneClienteDrive(sel).then((fetched) => {
          if (fetched) setTelefone(fetched);
        });
      }
      setFieldErrors((f) => ({ ...f, patient: undefined, telefone: undefined }));
    } else {
      setPatient('');
    }
  }, []);

  const onTelefoneFromCliente = useCallback((tel: string) => {
    setTelefone(aplicarMascaraWhatsapp(tel));
    setFieldErrors((f) => ({ ...f, telefone: undefined }));
  }, []);

  const modalInitKeyRef = useRef<string | null>(null);

  function applyClienteInicial(
    driveId: string | null | undefined,
    setters: {
      setPacienteSel: (v: string) => void;
      setPatient: (v: string) => void;
      setTelefone: (v: string) => void;
    },
  ) {
    const sel = selFromDriveId(driveId);
    setters.setPacienteSel(sel);
    if (!sel || clientesIniciais.length === 0) return;
    const c = clientesIniciais.find((x) => x.id === sel);
    if (!c) return;
    setters.setPatient(c.nome);
    const tel = telefoneFromOpcao(c);
    if (tel) setters.setTelefone(tel);
  }

  useEffect(() => {
    if (!open) {
      modalInitKeyRef.current = null;
      return;
    }

    const editingId = editingEvent?.id ? String(editingEvent.id) : null;
    const initKey = editingId ?? `new:${slotStart.getTime()}`;
    if (modalInitKeyRef.current === initKey) return;
    modalInitKeyRef.current = initKey;

    if (editingEvent) {
      setPacienteSel(selFromDriveId(editingEvent.clienteDriveId));
      setPatient(editingEvent.patient ?? '');
      setService(editingEvent.service ?? '');
      setLocation(editingEvent.location ?? defaultLocation);
      setMedico(editingEvent.medico ?? '');
      setObservacoes(editingEvent.observacoes ?? '');
      let tel = editingEvent.telefone ? aplicarMascaraWhatsapp(editingEvent.telefone) : '';
      if (!tel && editingEvent.clienteDriveId && clientesIniciais.length > 0) {
        const sel = selFromDriveId(editingEvent.clienteDriveId);
        const c = clientesIniciais.find((x) => x.id === sel);
        if (c?.telefone) tel = telefoneFromOpcao(c);
      }
      setTelefone(tel);
      setLembretesWhatsapp(editingEvent.lembretesWhatsapp !== false);
      const s = editingEvent.start ? new Date(String(editingEvent.start)) : slotStart;
      const e = editingEvent.end ? new Date(String(editingEvent.end)) : slotEnd;
      setData(format(s, 'yyyy-MM-dd'));
      setHoraInicio(format(s, 'HH:mm'));
      setHoraFim(format(e, 'HH:mm'));
    } else {
      setPacienteSel('');
      setPatient('');
      setTelefone('');
      applyClienteInicial(initialClienteId, { setPacienteSel, setPatient, setTelefone });
      setService('');
      setLocation(defaultLocation);
      setMedico(defaultMedicoFromList(medicos));
      setObservacoes('');
      setLembretesWhatsapp(true);
      const inicio = format(slotStart, 'HH:mm');
      setData(format(slotStart, 'yyyy-MM-dd'));
      setHoraInicio(inicio);
      setHoraFim(horaMaisMinutos(inicio));
    }
    setFieldErrors({});
    setWhatsappPickerOpen(false);
    setWhatsappPreview(null);
    setWhatsappErro(null);
    setSavedConsultaId(editingEvent?.id ? String(editingEvent.id) : null);
    setJustSaved(false);
  }, [open, editingEvent, slotStart, slotEnd, defaultLocation, medicos, initialClienteId, clientesIniciais]);

  // Complementa vínculo/WhatsApp quando clientesIniciais chega após abrir o modal (sem resetar o formulário).
  useEffect(() => {
    if (!open) return;

    const selVinculo =
      pacienteSel ||
      (editingEvent?.clienteDriveId ? selFromDriveId(editingEvent.clienteDriveId) : '');

    if (editingEvent?.clienteDriveId && !pacienteSel) {
      if (clientesIniciais.length > 0) {
        applyClienteInicial(editingEvent.clienteDriveId, { setPacienteSel, setPatient, setTelefone });
      }
      return;
    }

    if (!editingEvent && initialClienteId && !pacienteSel && clientesIniciais.length > 0) {
      applyClienteInicial(initialClienteId, { setPacienteSel, setPatient, setTelefone });
      return;
    }

    if (!selVinculo || telefonePreenchido(telefone)) return;

    const c = clientesIniciais.find((x) => x.id === selVinculo);
    const telLista = telefoneFromOpcao(c);
    if (telLista) {
      setTelefone(telLista);
      return;
    }

    if (selVinculo.startsWith('d:')) {
      void fetchTelefoneClienteDrive(selVinculo).then((fetched) => {
        if (fetched) setTelefone((prev) => (telefonePreenchido(prev) ? prev : fetched));
      });
    }
  }, [open, editingEvent, clientesIniciais, initialClienteId, pacienteSel, telefone]);

  const startComposto = useMemo(() => {
    if (!data || !horaInicio) return null;
    const d = new Date(`${data}T${horaInicio}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [data, horaInicio]);

  const tipoAuto = useMemo(() => {
    if (!startComposto || !patient.trim()) return 'nova_consulta' as const;
    const others = isEdit
      ? allEvents.filter((e) => String(e.id) !== String(editingEvent?.id))
      : allEvents;
    const tipo = classificarTipoConsulta(others, patient.trim(), startComposto);
    return tipo;
  }, [startComposto, patient, allEvents, isEdit, editingEvent?.id]);

  const tipoLabel =
    tipoAuto === 'retorno' ? ATENDIMENTO_LABEL.retorno : 'Nova sessão';

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  function validar(): FieldErrors {
    const errs: FieldErrors = {};
    const nomeTrim = patient.trim();
    if (!pacienteSel && nomeTrim.length < 2) {
      errs.patient = 'Selecione um cliente na lista ou informe o nome';
    }
    if (!isEdit && brPhoneLocalDigits(telefone).length < 10) {
      errs.telefone = 'Informe o WhatsApp com DDD para lembretes';
    }
    if (!data) errs.data = 'Informe a data';
    if (!horaInicio) errs.horaInicio = 'Informe o horário de início';
    if (!horaFim) errs.horaFim = 'Informe o horário de fim';
    const medicoErr = validateMedicoSelection(medicos, medico, isClinica);
    if (medicoErr) errs.medico = medicoErr;
    const ini = new Date(`${data}T${horaInicio}`);
    const fim = new Date(`${data}T${horaFim}`);
    if (!Number.isNaN(ini.getTime()) && !Number.isNaN(fim.getTime()) && fim <= ini) {
      errs.horaFim = 'O fim deve ser após o início';
    }
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
    setSubmitErro(null);

    const start = new Date(`${data}T${horaInicio}`);
    const end = new Date(`${data}T${horaFim}`);
    let driveId = pacienteSel.startsWith('d:') ? pacienteSel.slice(2) : null;
    let patientName = patient.trim();

    try {
      const resolved = await ensurePacienteCliente({
        nome: patientName,
        telefone: telefone.trim(),
        cliente_id: driveId ?? editingEvent?.clienteDriveId ?? null,
        paciente_sel: pacienteSel,
      });
      driveId = resolved.id;
      patientName = resolved.nome;
    } catch (err) {
      setSubmitErro(err instanceof Error ? err.message : 'Erro ao cadastrar cliente');
      return;
    }

    const savedId = await onConfirm({
      patient: patientName,
      service: service.trim(),
      start,
      end,
      value: editingEvent?.value ?? 0,
      location: location.trim(),
      convenio: editingEvent?.convenio ?? '',
      medico: resolveMedicoValue(medicos, medico),
      observacoes: observacoes.trim(),
      telefone: telefone.trim(),
      lembretesWhatsapp,
      clienteDriveId: driveId,
      pacienteSel,
      editingId: editingEvent?.id ? String(editingEvent.id) : null,
    });

    if (isEdit) {
      onClose();
      return;
    }

    if (savedId) {
      setSavedConsultaId(String(savedId));
      setJustSaved(true);
      setWhatsappPickerOpen(true);
    }
  }

  const temErros = Object.keys(fieldErrors).length > 0 || !!submitErro;

  async function enviarMensagemWhatsapp(tipo: MensagemTipo) {
    if (!whatsappPronto) return;
    const preOpened = isMobileDevice() ? null : preOpenExternalTab();
    setWhatsappLoading(true);
    setWhatsappErro(null);
    try {
      const res = await fetch('/api/consultas/mensagem-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          nome: patient.trim(),
          data,
          hora: horaInicio,
          telefone: telefone.trim(),
          medico: resolveMedicoValue(medicos, medico),
          local: location.trim(),
          consultaId:
            savedConsultaId ||
            (editingEvent?.id ? String(editingEvent.id) : null),
        }),
      });
      const dataRes = await res.json();
      if (!res.ok) {
        throw new Error(dataRes.error || 'Erro ao montar mensagem');
      }
      setWhatsappPreview(dataRes.mensagem ?? null);
      openWhatsAppUrl(dataRes.whatsapp_url as string, {
        appUrl: dataRes.whatsapp_app_url as string | undefined,
        androidUrl: dataRes.whatsapp_android_url as string | undefined,
        preOpened,
      });
    } catch (err) {
      preOpened?.close();
      setWhatsappErro(err instanceof Error ? err.message : 'Erro ao abrir WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-[#047482]" />
              {isEdit ? 'Editar atendimento' : 'Nova sessão'}
            </h2>
            <p className="text-sm text-gray-500">
              {data && horaInicio
                ? `${format(new Date(`${data}T${horaInicio}`), 'dd/MM/yyyy HH:mm')}`
                : 'Agende retorno ou próximo atendimento'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
          {temErros && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{submitErro || 'Preencha os campos obrigatórios marcados abaixo.'}</p>
            </div>
          )}

          {justSaved && (
            <div
              className="rounded-xl border border-[#047482]/30 bg-[#eef4f5] px-4 py-3 text-sm text-[#035e6b]"
              role="status"
            >
              Sessão agendada! Envie a confirmação no WhatsApp com link para o cliente adicionar
              à agenda dele.
            </div>
          )}

          {!isEdit ? (
            <PacienteSearchField
              value={pacienteSel}
              onChange={onPacientePicked}
              onTelefoneChange={onTelefoneFromCliente}
              telefoneAtual={telefone}
              clientesIniciais={clientesIniciais}
              preselectDriveId={initialClienteId}
              error={fieldErrors.patient}
              manualName={patient}
              onManualNameChange={(n) => {
                setPatient(n);
                if (fieldErrors.patient) setFieldErrors((f) => ({ ...f, patient: undefined }));
              }}
              manualNameError={!pacienteSel ? fieldErrors.patient : undefined}
            />
          ) : (
            <div className="space-y-2">
              {!editingEvent?.clienteDriveId && !pacienteSel.startsWith('d:') && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Este atendimento ainda não está vinculado ao cadastro. Selecione o cliente abaixo
                  ou confirme o nome — ao salvar, criamos ou encontramos a ficha no Drive.
                </p>
              )}
              <PacienteSearchField
                value={pacienteSel}
                onChange={onPacientePicked}
                onTelefoneChange={onTelefoneFromCliente}
                telefoneAtual={telefone}
                clientesIniciais={clientesIniciais}
                preselectDriveId={editingEvent?.clienteDriveId}
                label="Vincular ao cadastro"
                error={fieldErrors.patient}
                manualName={patient}
                onManualNameChange={(n) => {
                  setPatient(n);
                  if (fieldErrors.patient) setFieldErrors((f) => ({ ...f, patient: undefined }));
                }}
                manualNameError={!pacienteSel ? fieldErrors.patient : undefined}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp do cliente {!isEdit ? '*' : ''}
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={telefone}
                onChange={(e) => {
                  setTelefone(aplicarMascaraWhatsapp(e.target.value));
                  if (fieldErrors.telefone) setFieldErrors((f) => ({ ...f, telefone: undefined }));
                }}
                placeholder="(11) 99999-9999"
                className={`w-full rounded-xl border pl-10 pr-4 py-3 text-sm ${
                  fieldErrors.telefone ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
            </div>
            {fieldErrors.telefone && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.telefone}</p>
            )}
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lembretesWhatsapp}
                onChange={(e) => setLembretesWhatsapp(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
              />
              <span className="text-xs text-gray-600 leading-snug">
                Incluir esta sessão nos lembretes do Dashboard (
                {formatLembretesDashboardHint(lembretesSettings)}) — você envia pelo seu WhatsApp
                com mensagem personalizada.
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-gray-100 bg-[#f8f9fa] p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Mensagem WhatsApp</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Envie confirmação ou lembrete agora, sem esperar o Dashboard.
              </p>
            </div>
            {!whatsappPronto ? (
              <p className="text-xs text-gray-500">
                Preencha nome do cliente, data, horário e WhatsApp para habilitar o envio.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={whatsappLoading}
                  onClick={() => setWhatsappPickerOpen((v) => !v)}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {whatsappLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                  Enviar agendamento no WhatsApp
                </button>
                {whatsappPickerOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TEMPLATE_OPCOES.map(({ tipo, label }) => (
                      <button
                        key={tipo}
                        type="button"
                        disabled={whatsappLoading}
                        onClick={() => void enviarMensagemWhatsapp(tipo)}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-left text-sm font-medium text-gray-800 hover:border-[#25D366] hover:bg-green-50 disabled:opacity-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {whatsappPreview && (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap rounded-lg border border-gray-100 bg-white p-3 max-h-32 overflow-y-auto">
                    {whatsappPreview}
                  </p>
                )}
              </>
            )}
            {whatsappErro && <p className="text-xs text-red-600">{whatsappErro}</p>}
            <p className="text-[11px] text-gray-400">
              Abre o WhatsApp no navegador — confirme o envio no celular. Modelos em{' '}
              <span className="text-[#047482]">Comunicação → Configurações</span>.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serviço <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Ex: Corte, coloração"
              className={inputClass(false)}
            />
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
            className={inputClass(!!fieldErrors.medico)}
          />

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
            <p className="text-sm text-gray-700 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Tipo (automático)
            </p>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                tipoAuto === 'retorno'
                  ? 'bg-[#D9F0F2] text-[#035e6b]'
                  : 'bg-[#D9F0F2] text-[#035e6b]'
              }`}
            >
              {tipoLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Retorno se o cliente foi atendido nos últimos {DIAS_RETORNO} dias.
          </p>

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
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => {
                  const novo = e.target.value;
                  setHoraInicio(novo);
                  if (novo) setHoraFim(horaMaisMinutos(novo));
                  if (fieldErrors.horaInicio)
                    setFieldErrors((f) => ({ ...f, horaInicio: undefined, horaFim: undefined }));
                }}
                className={inputClass(!!fieldErrors.horaInicio)}
              />
              {fieldErrors.horaInicio && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.horaInicio}</p>
              )}
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fim *{' '}
                <span className="font-normal text-gray-400">
                  (padrão +{DURACAO_CONSULTA_MIN} min)
                </span>
              </label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => {
                  setHoraFim(e.target.value);
                  if (fieldErrors.horaFim)
                    setFieldErrors((f) => ({ ...f, horaFim: undefined }));
                }}
                className={inputClass(!!fieldErrors.horaFim)}
              />
              {fieldErrors.horaFim && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.horaFim}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              placeholder="Opcional"
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {isEdit && onDelete && (
              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => void onDelete()}
                className="w-full py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold flex items-center justify-center gap-2 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
                {deleting ? 'Excluindo...' : 'Excluir agendamento'}
              </button>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium"
              >
                {justSaved ? 'Fechar' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={saving || deleting || justSaved}
                className="flex-1 py-3 rounded-xl bg-[#047482] text-white font-semibold hover:bg-[#035e6b] disabled:opacity-50"
              >
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Agendar sessão'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
