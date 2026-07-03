'use client';

import { memo, useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import PacienteSearchField from '@/components/PacienteSearchField';
import MedicoSelect from '@/components/MedicoSelect';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { ensurePacienteCliente } from '@/lib/ensurePacienteClienteClient';
import { isValidPhone } from '@/lib/phoneMatch';
import {
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import type { PacienteOpcao } from '@/lib/types';
import {
  datetimeLocalMaisMinutos,
  shiftEndPreservingDuration,
  toDatetimeLocalValue,
} from '@/lib/consultations';

export type AgendaNovaSessaoSubmitData = {
  patientName: string;
  clienteDriveId?: string;
  service: string;
  start: Date;
  end: Date;
  location?: string;
  telefone: string;
  lembretesWhatsapp: boolean;
  medicoNome?: string;
  observacoes?: string;
};

type Props = {
  clientesIniciais: PacienteOpcao[];
  medicosOptions: string[];
  isClinica: boolean;
  duracaoPadraoMin: number | null;
  defaultLocation: string;
  isGoogleConnected: boolean;
  onReloadClientes: () => Promise<void>;
  /** Parent cria o evento e roda o sync — não alterar essa lógica no parent. */
  onSubmitSession: (data: AgendaNovaSessaoSubmitData) => Promise<void>;
};

function defaultStartEnd(duracaoPadraoMin: number | null) {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(8, 0, 0, 0);
  const start = toDatetimeLocalValue(amanha);
  let end = '';
  if (duracaoPadraoMin) {
    const fim = new Date(amanha);
    fim.setMinutes(fim.getMinutes() + duracaoPadraoMin);
    end = toDatetimeLocalValue(fim);
  }
  return { start, end };
}

function AgendaNovaSessaoForm({
  clientesIniciais,
  medicosOptions,
  isClinica,
  duracaoPadraoMin,
  defaultLocation,
  isGoogleConnected,
  onReloadClientes,
  onSubmitSession,
}: Props) {
  const [patient, setPatient] = useState('');
  const [service, setService] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [formPacienteSel, setFormPacienteSel] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formLembretes, setFormLembretes] = useState(true);
  const [formErro, setFormErro] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMedico, setFormMedico] = useState('');

  useEffect(() => {
    const defaults = defaultStartEnd(duracaoPadraoMin);
    setStart(defaults.start);
    setEnd(defaults.end);
  }, [duracaoPadraoMin]);

  useEffect(() => {
    if (medicosOptions.length === 1 && !formMedico) {
      setFormMedico(medicosOptions[0]);
    }
  }, [medicosOptions, formMedico]);

  const resetFields = () => {
    setPatient('');
    setFormPacienteSel('');
    setFormTelefone('');
    setObservacoes('');
    setLocation('');
    setService('');
    setFormErro(null);
    const defaults = defaultStartEnd(duracaoPadraoMin);
    setStart(defaults.start);
    setEnd(defaults.end);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formSubmitting) return;
    setFormErro(null);

    if (!patient.trim() && !formPacienteSel) {
      setFormErro('Selecione um cliente na lista ou informe o nome.');
      return;
    }
    if (!start || !end) {
      setFormErro('Informe início e fim do atendimento.');
      return;
    }
    if (!isValidPhone(formTelefone)) {
      setFormErro(
        'Informe o WhatsApp com DDD ou internacional (+código do país).',
      );
      return;
    }
    const medicoErr = validateMedicoSelection(
      medicosOptions,
      formMedico,
      isClinica,
    );
    if (medicoErr) {
      setFormErro(medicoErr);
      return;
    }

    setFormSubmitting(true);
    try {
      let patientName = patient.trim();
      let clienteDriveId: string | undefined;
      try {
        const resolved = await ensurePacienteCliente({
          nome: patientName,
          telefone: formTelefone.trim(),
          paciente_sel: formPacienteSel,
        });
        patientName = resolved.nome;
        clienteDriveId = resolved.id;
        await onReloadClientes();
      } catch (err) {
        setFormErro(
          err instanceof Error ? err.message : 'Erro ao cadastrar cliente',
        );
        return;
      }

      const medicoNome = resolveMedicoValue(medicosOptions, formMedico);
      await onSubmitSession({
        patientName,
        clienteDriveId,
        service,
        start: new Date(start),
        end: new Date(end),
        location: location || defaultLocation || undefined,
        telefone: formTelefone.trim(),
        lembretesWhatsapp: formLembretes,
        medicoNome: medicoNome || undefined,
        observacoes: observacoes || undefined,
      });
      resetFields();
    } catch (err) {
      setFormErro(
        err instanceof Error ? err.message : 'Erro ao salvar atendimento',
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div
      id="nova-consulta-form"
      data-tour="agenda-nova-sessao"
      className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm scroll-mt-6"
    >
      <PrimeirosPassosHint
        hintId="hint-agenda-nova-sessao"
        title="Nova sessão"
        message='Clique em um horário vazio na grade ou use o botão "Nova sessão" no topo.'
      />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#047482]">
            Nova sessão
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Ou clique na grade do calendário para abrir o formulário de agendamento.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {formErro && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
            {formErro}
          </p>
        )}
        <PacienteSearchField
          value={formPacienteSel}
          onChange={(sel, opt) => {
            setFormPacienteSel(sel);
            if (opt) setPatient(opt.nome);
            else setPatient('');
          }}
          onTelefoneChange={(tel) =>
            setFormTelefone(aplicarMascaraWhatsapp(tel))
          }
          telefoneAtual={formTelefone}
          clientesIniciais={clientesIniciais}
          manualName={patient}
          onManualNameChange={setPatient}
        />
        <label className="space-y-2 text-sm text-slate-700 min-w-0 block">
          WhatsApp (DDD) *
          <input
            type="tel"
            value={formTelefone}
            onChange={(e) =>
              setFormTelefone(aplicarMascaraWhatsapp(e.target.value))
            }
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
            placeholder="(11) 99999-9999"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={formLembretes}
            onChange={(e) => setFormLembretes(e.target.checked)}
            className="mt-1 rounded border-slate-300 text-[#047482]"
          />
          <span>Incluir nos lembretes WhatsApp do Dashboard</span>
        </label>
        <label className="space-y-2 text-sm text-slate-700 min-w-0 block">
          Serviço <span className="text-slate-400 font-normal">(opcional)</span>
          <input
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
            placeholder="Ex: Corte, coloração"
          />
        </label>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700 min-w-0">
            Início *
            <input
              required
              type="datetime-local"
              value={start}
              onChange={(e) => {
                const v = e.target.value;
                setStart(v);
                if (!v) return;
                if (end) {
                  const shifted = shiftEndPreservingDuration(start, v, end);
                  if (shifted) {
                    setEnd(toDatetimeLocalValue(shifted));
                    return;
                  }
                }
                if (duracaoPadraoMin) {
                  setEnd(datetimeLocalMaisMinutos(v, duracaoPadraoMin));
                }
              }}
              className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-700 min-w-0">
            Fim *
            <input
              required
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
            />
          </label>
        </div>
        <MedicoSelect
          medicos={medicosOptions}
          isClinica={isClinica}
          value={formMedico}
          onChange={setFormMedico}
          className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900"
        />
        <label className="space-y-2 text-sm text-slate-700 min-w-0">
          Endereço
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Rua, número, bairro - Cidade/UF"
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
          />
          {location && isGoogleConnected && (
            <p className="text-xs text-blue-500">
              O endereço será incluído no evento da agenda Google.
            </p>
          )}
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          Observações
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Notas adicionais para o evento..."
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
          />
        </label>
        <button
          type="submit"
          disabled={formSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)] touch-manipulation disabled:opacity-60 disabled:pointer-events-none"
        >
          {formSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Salvando...
            </>
          ) : isGoogleConnected ? (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#4285F4">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
              </svg>
              Salvar no Google Calendar
            </>
          ) : (
            'Salvar atendimento'
          )}
        </button>
      </form>
    </div>
  );
}

export default memo(AgendaNovaSessaoForm);
