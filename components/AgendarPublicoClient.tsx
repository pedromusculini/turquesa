'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  User,
} from 'lucide-react';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import { aplicarMascaraWhatsapp, PHONE_INTL_HINT, phoneInputPlaceholder } from '@/lib/constants';
import { isInternationalPhoneInput, isValidPhone } from '@/lib/phoneMatch';
import MedicoPublicoPicker from '@/components/MedicoPublicoPicker';
import type { MedicoPublico } from '@/lib/medicosPublicos';
import {
  defaultMedicoPublicoNome,
  findMedicoPublico,
  medicoPublicoSubtitle,
  medicosPublicosAgendaveis,
  needsMedicoPublicoChoice,
} from '@/lib/medicosPublicos';

type Step = 'telefone' | 'cadastro' | 'medico' | 'horario' | 'confirmar' | 'sucesso';

type Slot = { inicio: string; fim: string };

type Info = {
  nome_exibicao: string;
  user_type: string;
  is_clinica?: boolean;
  medicos: MedicoPublico[];
  max_date?: string;
  paciente_pessoal: { nome: string; cliente_drive_id: string; telefone: string } | null;
};

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export default function AgendarPublicoClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const pToken = searchParams.get('p');

  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('telefone');
  const [submitting, setSubmitting] = useState(false);

  const [telefone, setTelefone] = useState('');
  const [encontrado, setEncontrado] = useState(false);
  const [nomePaciente, setNomePaciente] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [clienteDriveId, setClienteDriveId] = useState<string | null>(null);
  const [cpf, setCpf] = useState('');
  const [medico, setMedico] = useState('');
  const [data, setData] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotSel, setSlotSel] = useState<Slot | null>(null);
  const [slotsMessage, setSlotsMessage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [sucesso, setSucesso] = useState<{ mensagem?: string } | null>(null);
  const [medicoErro, setMedicoErro] = useState<string | undefined>();

  const medicosAgendaveis = useMemo(
    () => medicosPublicosAgendaveis(info?.medicos ?? []),
    [info?.medicos],
  );

  const nomeConfirmacao = encontrado ? nomeExibicao : nomePaciente;
  const needsMedico = needsMedicoPublicoChoice(info?.medicos ?? []);
  const nenhumAgendavel = !!info && medicosAgendaveis.length === 0;

  const minDate = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }, []);

  const maxDate = useMemo(
    () => info?.max_date ?? addDaysToDateString(minDate, 15),
    [info?.max_date, minDate],
  );

  const loadInfo = useCallback(async () => {
    const params = new URLSearchParams({ slug });
    if (pToken) params.set('p', pToken);
    const res = await fetch(`/api/agendar/info?${params}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Link inválido');
    setInfo(d);
    const unicoGeral = defaultMedicoPublicoNome(d.medicos);
    if (unicoGeral) setMedico(unicoGeral);
    if (d.paciente_pessoal) {
      setNomePaciente(d.paciente_pessoal.nome);
      setClienteDriveId(d.paciente_pessoal.cliente_drive_id);
      if (d.paciente_pessoal.telefone) setTelefone(d.paciente_pessoal.telefone);
      setEncontrado(true);
      setStep(needsMedicoPublicoChoice(d.medicos) ? 'medico' : 'horario');
    }
  }, [slug, pToken]);

  useEffect(() => {
    loadInfo()
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [loadInfo]);

  async function identificarTel() {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/agendar/identificar?slug=${encodeURIComponent(slug)}&telefone=${encodeURIComponent(telefone)}`,
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.encontrado) {
        setEncontrado(true);
        setNomeExibicao(d.nome_parcial || '');
        setNomePaciente('');
        setClienteDriveId(d.cliente_drive_id);
        setStep(needsMedico ? 'medico' : 'horario');
      } else {
        setEncontrado(false);
        setStep('cadastro');
      }
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadSlots(dateVal: string, medicoVal: string) {
    if (!dateVal || !medicoVal) return;
    setSlotsLoading(true);
    setSlots([]);
    setSlotSel(null);
    setSlotsMessage(null);
    try {
      const params = new URLSearchParams({
        slug,
        data: dateVal,
        medico: medicoVal,
      });
      const res = await fetch(`/api/agendar/slots?${params}`);
      const d = await res.json();
      if (!res.ok) {
        if (d.code === 'no_calendar') {
          setSlotsMessage('Profissional sem agenda conectada.');
        } else {
          throw new Error(d.error || 'Erro ao carregar horários');
        }
        return;
      }
      setSlots(d.slots || []);
      if ((d.slots || []).length === 0) {
        setSlotsMessage('Nenhum horário disponível nesta data.');
      }
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar horários');
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    if (step === 'horario' && data && medico) loadSlots(data, medico);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data, medico]);

  async function confirmar() {
    if (!slotSel || !consent || !medico) return;
    setSubmitting(true);
    setErro(null);
    try {
      const res = await fetch('/api/agendar/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          telefone,
          nome: encontrado ? undefined : nomePaciente,
          cpf,
          medico,
          inicio: slotSel.inicio,
          fim: slotSel.fim,
          tipo: 'nova',
          cliente_drive_id: clienteDriveId,
          dataConsent: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSucesso(d);
      setStep('sucesso');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setSubmitting(false);
    }
  }

  function voltar() {
    setErro(null);
    if (step === 'cadastro') setStep('telefone');
    else if (step === 'medico') setStep(encontrado ? 'telefone' : 'cadastro');
    else if (step === 'horario') setStep(needsMedico ? 'medico' : encontrado ? 'telefone' : 'cadastro');
    else if (step === 'confirmar') setStep('horario');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="w-8 h-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  if (erro && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-red-600 text-center">{erro}</p>
      </div>
    );
  }

  if (step === 'sucesso') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#eef4f5] to-white px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <CheckCircle2 className="w-16 h-16 text-[#047482] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Sessão reservada!</h1>
          <p className="text-gray-600 mt-2">
            {info?.nome_exibicao} receberá sua reserva. Guarde este comprovante.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4f5] to-[#f8f9fa]">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <BrandLogoIcon size={40} className="h-10 w-10 rounded-xl" priority />
          <div>
            <p className="text-xs text-gray-500">Agendar sessão</p>
            <h1 className="font-bold text-gray-900 leading-tight">{info?.nome_exibicao}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {erro && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{erro}</div>
        )}

        {nenhumAgendavel && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <p className="font-medium">Agendamento online indisponível</p>
            <p className="mt-1 text-xs">
              Nenhuma profissional com agenda Google conectada. Entre em contato com o salão.
            </p>
          </div>
        )}

        {step !== 'telefone' && !pToken && (
          <button
            type="button"
            onClick={voltar}
            className="mb-4 flex items-center gap-1 text-sm text-[#047482] font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          {step === 'telefone' && !pToken && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Seu WhatsApp</h2>
              <p className="text-sm text-gray-500">
                Usamos o telefone para identificar se você já é cliente.
              </p>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(aplicarMascaraWhatsapp(e.target.value))}
                  placeholder={phoneInputPlaceholder(telefone)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              {isInternationalPhoneInput(telefone) && (
                <p className="text-xs text-gray-500">{PHONE_INTL_HINT}</p>
              )}
              <button
                type="button"
                disabled={submitting || !isValidPhone(telefone) || nenhumAgendavel}
                onClick={identificarTel}
                className="w-full py-3.5 rounded-xl bg-[#047482] hover:bg-[#035e6b] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continuar'}
                {!submitting && <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          )}

          {step === 'cadastro' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-[#047482]" />
                Seus dados
              </h2>
              <input
                type="text"
                value={nomePaciente}
                onChange={(e) => setNomePaciente(e.target.value)}
                placeholder="Nome completo *"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm"
              />
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="CPF (opcional)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setMedicoErro(undefined);
                  if (!medico && medicosAgendaveis.length > 0) {
                    setMedicoErro('Selecione o profissional');
                    setStep('medico');
                    return;
                  }
                  setStep(needsMedico || medicosAgendaveis.length > 1 ? 'medico' : 'horario');
                }}
                disabled={nomePaciente.trim().length < 2 || nenhumAgendavel}
                className="w-full py-3.5 rounded-xl bg-[#047482] text-white font-semibold text-sm disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          )}

          {step === 'medico' && (
            <div className="space-y-4">
              {encontrado && nomeExibicao && (
                <p className="text-sm text-[#047482] bg-[#eef4f5] px-3 py-2 rounded-lg">
                  Olá, {nomeExibicao.split(' ')[0]}!
                </p>
              )}
              <MedicoPublicoPicker
                medicos={medicosAgendaveis}
                isClinica={info?.is_clinica}
                value={medico}
                onChange={(nome) => {
                  setMedico(nome);
                  setMedicoErro(undefined);
                  setData('');
                  setSlots([]);
                }}
                error={medicoErro}
                emptyMessage="Nenhuma profissional com agenda conectada no momento."
              />
              <button
                type="button"
                disabled={!medico || medicosAgendaveis.length === 0}
                onClick={() => {
                  if (!medico) {
                    setMedicoErro('Selecione o profissional');
                    return;
                  }
                  setStep('horario');
                }}
                className="w-full py-3.5 rounded-xl bg-[#047482] text-white font-semibold text-sm disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          )}

          {step === 'horario' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#047482]" />
                Data e horário
              </h2>
              {medico && (
                <p className="text-sm text-gray-600">
                  Profissional: <strong>{medico}</strong>
                </p>
              )}
              {encontrado && nomeExibicao && (
                <p className="text-sm text-gray-600">
                  Olá, <strong>{nomeExibicao.split(' ')[0]}</strong>
                </p>
              )}
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm"
              />
              <p className="text-xs text-gray-500">
                Agendamento até {new Date(`${maxDate}T12:00:00`).toLocaleDateString('pt-BR')}
              </p>
              {slotsLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-[#047482]" />
                </div>
              )}
              {!slotsLoading && slotsMessage && (
                <p className="text-sm text-gray-500 text-center py-4">{slotsMessage}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slots.map((s) => {
                  const t = new Date(s.inicio).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo',
                  });
                  const sel = slotSel?.inicio === s.inicio;
                  return (
                    <button
                      key={s.inicio}
                      type="button"
                      onClick={() => {
                        setSlotSel(s);
                        setStep('confirmar');
                      }}
                      className={`py-2.5 rounded-xl text-sm font-medium border-2 ${
                        sel
                          ? 'border-[#047482] bg-[#eef4f5] text-[#047482]'
                          : 'border-gray-100 text-gray-800 hover:border-[#3795a1]'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'confirmar' && slotSel && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Confirmar</h2>
              <dl className="text-sm space-y-2 bg-[#f8f9fa] rounded-xl p-4">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Cliente</dt>
                  <dd className="font-medium">{nomeConfirmacao}</dd>
                </div>
                {medico && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Profissional</dt>
                    <dd className="font-medium text-right">
                      {medico}
                      {(() => {
                        const m = findMedicoPublico(info?.medicos ?? [], medico);
                        const sub = m ? medicoPublicoSubtitle(m) : '';
                        return sub ? (
                          <span className="block text-xs font-normal text-gray-500">{sub}</span>
                        ) : null;
                      })()}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Horário</dt>
                  <dd className="font-medium">
                    {new Date(slotSel.inicio).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </dd>
                </div>
              </dl>
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-[#047482]"
                />
                Autorizo o uso dos meus dados para este agendamento, conforme a política de
                privacidade do salão (LGPD).
              </label>
              <button
                type="button"
                disabled={submitting || !consent}
                onClick={confirmar}
                className="w-full py-3.5 rounded-xl bg-[#047482] text-white font-semibold text-sm disabled:opacity-50 flex justify-center"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar reserva'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
