'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { parseEventDate, type ConsultationRecord } from '@/lib/consultations';

const CELULAR_MQ = '(max-width: 767px)';

function subscribeCelular(cb: () => void) {
  const mq = window.matchMedia(CELULAR_MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** true só em tela de celular; no SSR e no primeiro paint retorna false (campos nativos). */
export function useIsCelular(): boolean {
  return useSyncExternalStore(
    subscribeCelular,
    () => window.matchMedia(CELULAR_MQ).matches,
    () => false,
  );
}

const DIAS_FAIXA = 14;
const SLOT_MIN = 30;
const ABERTURA_MIN = 7 * 60;
const FECHAMENTO_MIN = 21 * 60;
const MAX_SUGESTOES = 8;
const DURACOES = [30, 45, 60, 90, 120];
const DIA_SEMANA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const DIA_SEMANA_LONGO = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n: number) => String(n).padStart(2, '0');

function isoDia(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIsoDia(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function hhmmParaMin(h: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(h);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

function minParaHhmm(min: number) {
  const v = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
}

function mascaraHora(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "14" → 14:00, "930" → 09:30, "1430" → 14:30; inválido → '' */
function normalizarHora(v: string): string {
  const d = v.replace(/\D/g, '');
  if (!d) return '';
  let out: string;
  if (d.length <= 2) out = `${pad(Number(d))}:00`;
  else if (d.length === 3) out = `0${d[0]}:${d.slice(1)}`;
  else out = `${d.slice(0, 2)}:${d.slice(2, 4)}`;
  return hhmmParaMin(out) == null ? '' : out;
}

function mascaraData(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** DD/MM/AAAA ou DD/MM (ano = próxima ocorrência) → YYYY-MM-DD */
function dataDigitadaParaIso(v: string, hoje: Date): string | null {
  const m = /^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/.exec(v);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]) - 1;
  let ano = m[3] ? Number(m[3]) : hoje.getFullYear();
  let d = new Date(ano, mes, dia);
  if (!m[3] && d < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
    ano += 1;
    d = new Date(ano, mes, dia);
  }
  if (d.getDate() !== dia || d.getMonth() !== mes) return null;
  return isoDia(d);
}

function isoParaDigitada(iso: string) {
  const d = parseIsoDia(iso);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
}

function rotuloDuracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h${pad(r)}` : `${h}h`;
}

type Intervalo = { ini: number; fim: number };

/** Intervalos (minutos do dia) ocupados em `dataIso`, ignorando canceladas e a sessão em edição. */
export function ocupadosNoDia(
  eventos: ConsultationRecord[] | undefined,
  dataIso: string,
  opts: { medico?: string; ignorarId?: string | null } = {},
): Intervalo[] | null {
  if (!eventos) return null;
  const medico = opts.medico?.trim().toLowerCase();
  const out: Intervalo[] = [];
  for (const ev of eventos) {
    if (ev.status === 'cancelado') continue;
    if (opts.ignorarId && ev.id != null && String(ev.id) === opts.ignorarId) continue;
    if (medico && ev.medico && ev.medico.trim().toLowerCase() !== medico) continue;
    const s = parseEventDate(ev.start);
    if (!s || isoDia(s) !== dataIso) continue;
    const e = parseEventDate(ev.end);
    const ini = s.getHours() * 60 + s.getMinutes();
    const fim = e && isoDia(e) === dataIso ? e.getHours() * 60 + e.getMinutes() : ini + SLOT_MIN;
    out.push({ ini, fim: Math.max(fim, ini + 1) });
  }
  return out;
}

type Props = {
  data: string;
  horaInicio: string;
  horaFim: string;
  onChange: (v: { data: string; horaInicio: string; horaFim: string }) => void;
  /** null = agenda não disponível (sugere horários sem filtrar ocupados) */
  ocupados: Intervalo[] | null;
  duracaoPadraoMin?: number | null;
  erroData?: string;
  erroHora?: string;
};

export default function DataHoraSessaoMobile({
  data,
  horaInicio,
  horaFim,
  onChange,
  ocupados,
  duracaoPadraoMin,
  erroData,
  erroHora,
}: Props) {
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dias = useMemo(
    () =>
      Array.from({ length: DIAS_FAIXA }, (_, i) => {
        const d = new Date(hoje);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [hoje],
  );

  const dataNaFaixa = dias.some((d) => isoDia(d) === data);
  const [digitandoData, setDigitandoData] = useState(() => !!data && !dataNaFaixa);
  const [dataTexto, setDataTexto] = useState(() => isoParaDigitada(data));
  const [horaTexto, setHoraTexto] = useState(horaInicio);
  const [ajustarFim, setAjustarFim] = useState(false);
  const [fimTexto, setFimTexto] = useState(horaFim);

  const [propsAnteriores, setPropsAnteriores] = useState({ data, horaInicio, horaFim });
  if (
    propsAnteriores.data !== data ||
    propsAnteriores.horaInicio !== horaInicio ||
    propsAnteriores.horaFim !== horaFim
  ) {
    setPropsAnteriores({ data, horaInicio, horaFim });
    if (propsAnteriores.horaInicio !== horaInicio) setHoraTexto(horaInicio);
    if (propsAnteriores.horaFim !== horaFim) setFimTexto(horaFim);
    if (propsAnteriores.data !== data && !digitandoData) setDataTexto(isoParaDigitada(data));
  }

  const iniMin = hhmmParaMin(horaInicio);
  const fimMin = hhmmParaMin(horaFim);
  const duracaoAtual =
    iniMin != null && fimMin != null && fimMin > iniMin ? fimMin - iniMin : null;
  const duracaoEscolha = duracaoAtual ?? duracaoPadraoMin ?? 60;

  const emitir = (patch: Partial<{ data: string; horaInicio: string; horaFim: string }>) => {
    onChange({ data, horaInicio, horaFim, ...patch });
  };

  const escolherInicio = (hhmm: string) => {
    const ini = hhmmParaMin(hhmm);
    if (ini == null) {
      emitir({ horaInicio: hhmm });
      return;
    }
    emitir({ horaInicio: hhmm, horaFim: minParaHhmm(ini + duracaoEscolha) });
  };

  const escolherDuracao = (min: number) => {
    if (iniMin == null) return;
    emitir({ horaFim: minParaHhmm(iniMin + min) });
  };

  const sugestoes = useMemo(() => {
    const dia = parseIsoDia(data);
    if (!dia) return [];
    const agora = new Date();
    const ehHoje = isoDia(dia) === isoDia(agora);
    const minAgora = agora.getHours() * 60 + agora.getMinutes();
    const out: string[] = [];
    for (let t = ABERTURA_MIN; t + duracaoEscolha <= FECHAMENTO_MIN; t += SLOT_MIN) {
      if (ehHoje && t <= minAgora) continue;
      const conflito = ocupados?.some((o) => t < o.fim && t + duracaoEscolha > o.ini);
      if (conflito) continue;
      out.push(minParaHhmm(t));
      if (out.length >= MAX_SUGESTOES) break;
    }
    return out;
  }, [data, ocupados, duracaoEscolha]);

  const dataSel = parseIsoDia(data);
  const resumo =
    dataSel && iniMin != null && fimMin != null
      ? `${DIA_SEMANA_LONGO[dataSel.getDay()]}, ${dataSel.getDate()} de ${MESES[dataSel.getMonth()]} · ${horaInicio} até ${horaFim}`
      : null;

  const chipBase =
    'min-h-10 rounded-xl border text-sm tabular-nums transition-colors touch-manipulation';
  const chipOff = 'border-slate-200 bg-white text-slate-800 active:bg-slate-100';
  const chipOn = 'border-[#047482] bg-[#047482] text-white';
  const inputBase =
    'w-full rounded-xl border px-3 py-2.5 text-base tabular-nums outline-none focus:border-[#3795a1]';

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Dia *</span>
          <button
            type="button"
            className="text-xs font-medium text-[#047482]"
            onClick={() => {
              if (digitandoData) {
                setDigitandoData(false);
                if (!dataNaFaixa) emitir({ data: isoDia(hoje) });
              } else {
                setDataTexto(isoParaDigitada(data));
                setDigitandoData(true);
              }
            }}
          >
            {digitandoData ? 'Escolher nos próximos dias' : 'Digitar outra data'}
          </button>
        </div>
        {digitandoData ? (
          <input
            autoFocus
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            value={dataTexto}
            onChange={(e) => {
              const v = mascaraData(e.target.value);
              setDataTexto(v);
              const iso = dataDigitadaParaIso(v, hoje);
              if (iso) emitir({ data: iso });
            }}
            onBlur={() => {
              const iso = dataDigitadaParaIso(dataTexto, hoje);
              if (iso) setDataTexto(isoParaDigitada(iso));
            }}
            className={`${inputBase} ${erroData ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
          />
        ) : (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {dias.map((d, i) => {
              const iso = isoDia(d);
              const ativo = iso === data;
              const rotulo = i === 0 ? 'HOJE' : i === 1 ? 'AMANHÃ' : DIA_SEMANA_CURTO[d.getDay()];
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => emitir({ data: iso })}
                  className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-1.5 touch-manipulation ${
                    ativo ? chipOn : chipOff
                  }`}
                >
                  <span className="text-[9px] tracking-wide opacity-80">{rotulo}</span>
                  <span className="text-lg font-semibold leading-tight">{d.getDate()}</span>
                  <span className="text-[10px] opacity-70">{MESES[d.getMonth()]}</span>
                </button>
              );
            })}
          </div>
        )}
        {erroData && <p className="mt-1 text-xs text-red-600">{erroData}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Início *</label>
        <input
          inputMode="numeric"
          placeholder="Digite (ex.: 1430) ou toque abaixo"
          value={horaTexto}
          onChange={(e) => {
            const v = mascaraHora(e.target.value);
            setHoraTexto(v);
            if (v.length === 5 && hhmmParaMin(v) != null) escolherInicio(v);
          }}
          onBlur={() => {
            const n = normalizarHora(horaTexto);
            if (n && n !== horaInicio) escolherInicio(n);
            else setHoraTexto(n || horaInicio);
          }}
          className={`${inputBase} ${erroHora ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
        />
        {sugestoes.length > 0 && (
          <>
            <p className="mb-1.5 mt-2 text-[11px] text-slate-500">
              {ocupados ? 'Próximos horários livres' : 'Horários sugeridos'}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => escolherInicio(s)}
                  className={`${chipBase} ${s === horaInicio ? chipOn : chipOff}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {erroHora && <p className="mt-1 text-xs text-red-600">{erroHora}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Duração</label>
        <div className="flex flex-wrap gap-1.5">
          {duracaoAtual != null && !DURACOES.includes(duracaoAtual) && (
            <button type="button" className={`${chipBase} px-3 ${chipOn}`}>
              {rotuloDuracao(duracaoAtual)}
            </button>
          )}
          {DURACOES.map((m) => (
            <button
              key={m}
              type="button"
              disabled={iniMin == null}
              onClick={() => escolherDuracao(m)}
              className={`${chipBase} px-3 disabled:opacity-40 ${duracaoAtual === m ? chipOn : chipOff}`}
            >
              {rotuloDuracao(m)}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          {ajustarFim ? (
            <>
              <span>Termina às</span>
              <input
                autoFocus
                inputMode="numeric"
                placeholder="HH:MM"
                value={fimTexto}
                onChange={(e) => {
                  const v = mascaraHora(e.target.value);
                  setFimTexto(v);
                  if (v.length === 5 && hhmmParaMin(v) != null) emitir({ horaFim: v });
                }}
                onBlur={() => {
                  const n = normalizarHora(fimTexto);
                  if (n) emitir({ horaFim: n });
                  else setFimTexto(horaFim);
                  setAjustarFim(false);
                }}
                className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-base tabular-nums"
              />
            </>
          ) : (
            horaFim && (
              <>
                <span>Termina às {horaFim}</span>
                <button
                  type="button"
                  className="font-medium text-[#047482]"
                  onClick={() => setAjustarFim(true)}
                >
                  ajustar
                </button>
              </>
            )
          )}
        </div>
      </div>

      {resumo && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 first-letter:uppercase">
          {resumo}
        </p>
      )}
    </div>
  );
}
