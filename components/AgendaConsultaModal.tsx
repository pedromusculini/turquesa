'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, CalendarPlus, User, RotateCcw, AlertCircle, Phone } from 'lucide-react';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { format } from 'date-fns';
import ConvenioSelect from '@/components/ConvenioSelect';
import MedicoSelect from '@/components/MedicoSelect';
import {
  defaultMedicoFromList,
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import PacienteSearchField from '@/components/PacienteSearchField';
import type { PacienteOpcao } from '@/lib/types';
import { selFromDriveId } from '@/lib/pacienteOpcoesUi';
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
  Record<'patient' | 'data' | 'horaInicio' | 'horaFim' | 'medico' | 'service' | 'telefone', string>
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
  onConfirm: (payload: AgendaConsultaPayload) => void | Promise<void>;
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
  const [service, setService] = useState('Consulta médica');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [value, setValue] = useState('200');
  const [location, setLocation] = useState('');
  const [convenio, setConvenio] = useState('');
  const [medico, setMedico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [telefone, setTelefone] = useState('');
  const [lembretesWhatsapp, setLembretesWhatsapp] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitErro, setSubmitErro] = useState<string | null>(null);

  const onPacientePicked = useCallback((sel: string, opt: PacienteOpcao | null) => {
    setPacienteSel(sel);
    if (opt) {
      setPatient(opt.nome);
      if (opt.telefone) setTelefone(aplicarMascaraWhatsapp(opt.telefone));
      if (opt.convenio) setConvenio(opt.convenio);
      setFieldErrors((f) => ({ ...f, patient: undefined, telefone: undefined }));
    } else {
      setPatient('');
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    if (editingEvent) {
      setPacienteSel('');
      setPatient(editingEvent.patient ?? '');
      setService(editingEvent.service ?? 'Consulta médica');
      setValue(String(editingEvent.value ?? 200));
      setLocation(editingEvent.location ?? defaultLocation);
      setConvenio(editingEvent.convenio ?? '');
      setMedico(editingEvent.medico ?? '');
      setObservacoes(editingEvent.observacoes ?? '');
      setTelefone(editingEvent.telefone ? aplicarMascaraWhatsapp(editingEvent.telefone) : '');
      setLembretesWhatsapp(editingEvent.lembretesWhatsapp !== false);
      const s = editingEvent.start ? new Date(String(editingEvent.start)) : slotStart;
      const e = editingEvent.end ? new Date(String(editingEvent.end)) : slotEnd;
      setData(format(s, 'yyyy-MM-dd'));
      setHoraInicio(format(s, 'HH:mm'));
      setHoraFim(format(e, 'HH:mm'));
    } else {
      const preSel = selFromDriveId(initialClienteId);
      setPacienteSel(preSel);
      setPatient('');
      setTelefone('');
      if (preSel && clientesIniciais.length > 0) {
        const c = clientesIniciais.find((x) => x.id === preSel);
        if (c) {
          setPatient(c.nome);
          if (c.telefone) setTelefone(aplicarMascaraWhatsapp(c.telefone));
          if (c.convenio) setConvenio(c.convenio);
        }
      }
      setService('Consulta médica');
      setValue('200');
      setLocation(defaultLocation);
      if (!preSel) setConvenio('');
      setMedico(defaultMedicoFromList(medicos));
      setObservacoes('');
      setLembretesWhatsapp(true);
      const inicio = format(slotStart, 'HH:mm');
      setData(format(slotStart, 'yyyy-MM-dd'));
      setHoraInicio(inicio);
      setHoraFim(horaMaisMinutos(inicio));
    }
    setFieldErrors({});
  }, [open, editingEvent, slotStart, slotEnd, defaultLocation, medicos, initialClienteId, clientesIniciais]);

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
    tipoAuto === 'retorno' ? ATENDIMENTO_LABEL.retorno : 'Nova consulta';

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
    if (!isEdit) {
      if (!pacienteSel && nomeTrim.length < 2) {
        errs.patient = 'Selecione um paciente na lista ou informe o nome';
      }
    } else if (nomeTrim.length < 2) {
      errs.patient = 'Informe o nome do paciente';
    }
    if (!isEdit && brPhoneLocalDigits(telefone).length < 10) {
      errs.telefone = 'Informe o WhatsApp com DDD para lembretes';
    }
    if (!service.trim()) errs.service = 'Informe o serviço';
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

    if (!isEdit) {
      try {
        const resolved = await ensurePacienteCliente({
          nome: patientName,
          telefone: telefone.trim(),
          cliente_id: driveId,
          paciente_sel: pacienteSel,
        });
        driveId = resolved.id;
        patientName = resolved.nome;
        if (resolved.convenio && !convenio.trim()) setConvenio(resolved.convenio);
      } catch (err) {
        setSubmitErro(err instanceof Error ? err.message : 'Erro ao cadastrar paciente');
        return;
      }
    }

    await onConfirm({
      patient: patientName,
      service: service.trim(),
      start,
      end,
      value: Number(value) || 0,
      location: location.trim(),
      convenio: convenio.trim(),
      medico: resolveMedicoValue(medicos, medico),
      observacoes: observacoes.trim(),
      telefone: telefone.trim(),
      lembretesWhatsapp,
      clienteDriveId: driveId,
      pacienteSel,
      editingId: editingEvent?.id ? String(editingEvent.id) : null,
    });
  }

  const temErros = Object.keys(fieldErrors).length > 0 || !!submitErro;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-[#228B22]" />
              {isEdit ? 'Editar consulta' : 'Nova consulta'}
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

          {!isEdit ? (
            <PacienteSearchField
              value={pacienteSel}
              onChange={onPacientePicked}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do paciente *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={patient}
                  onChange={(e) => {
                    setPatient(e.target.value);
                    if (fieldErrors.patient) setFieldErrors((f) => ({ ...f, patient: undefined }));
                  }}
                  className={`w-full rounded-xl border pl-10 pr-4 py-3 text-sm ${
                    fieldErrors.patient ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                />
              </div>
              {fieldErrors.patient && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.patient}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp do paciente {!isEdit ? '*' : ''}
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
                className="mt-1 rounded border-gray-300 text-[#228B22] focus:ring-[#228B22]"
              />
              <span className="text-xs text-gray-600 leading-snug">
                Incluir esta consulta nos lembretes do Dashboard (7 e 1 dia antes) — você envia pelo
                seu WhatsApp com mensagem personalizada.
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serviço *</label>
            <input
              type="text"
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                if (fieldErrors.service) setFieldErrors((f) => ({ ...f, service: undefined }));
              }}
              className={inputClass(!!fieldErrors.service)}
            />
            {fieldErrors.service && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.service}</p>
            )}
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
            label="Médico"
          />

          <ConvenioSelect
            value={convenio}
            onChange={setConvenio}
            label="Plano / convênio"
            allowEmpty
            emptyLabel="Particular ou não informado"
          />

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
            <p className="text-sm text-gray-700 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Tipo (automático)
            </p>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                tipoAuto === 'retorno'
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {tipoLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Retorno se o paciente foi atendido nos últimos {DIAS_RETORNO} dias.
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
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
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="flex-1 py-3 rounded-xl bg-[#013a01] text-white font-semibold hover:bg-[#025201] disabled:opacity-50"
              >
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Agendar consulta'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
