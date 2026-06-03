'use client';

import { useMemo, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import type { DispSlotInput } from '@/lib/disponibilidadeSlots';
import { addMinutesToTime, normalizeDisponibilidadeForSave } from '@/lib/disponibilidadeSlots';

const DIAS = [
  { v: 1, l: 'Seg' },
  { v: 2, l: 'Ter' },
  { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' },
  { v: 5, l: 'Sex' },
  { v: 6, l: 'Sáb' },
  { v: 0, l: 'Dom' },
];

const DIAS_FULL: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

const DURACOES = [20, 30, 40, 50, 60];

const HORAS = Array.from({ length: 18 }, (_, i) => i + 6);
const MINUTOS = ['00', '15', '30', '45'];

type Props = {
  rows: DispSlotInput[];
  onChange: (rows: DispSlotInput[]) => void;
  userType: string;
  medicos: string[];
  saving: boolean;
  onSave: () => void;
};

function slotKey(row: DispSlotInput): string {
  return `${row.dia_semana}|${row.hora_inicio}|${row.duracao_minutos}|${row.medico_nome ?? ''}`;
}

export default function HorariosAgendaEditor({
  rows,
  onChange,
  userType,
  medicos,
  saving,
  onSave,
}: Props) {
  const [diasSel, setDiasSel] = useState<number[]>([1, 2, 3, 4, 5]);
  const [horaH, setHoraH] = useState('8');
  const [horaM, setHoraM] = useState('00');
  const [horariosPendentes, setHorariosPendentes] = useState<string[]>([]);
  const [duracao, setDuracao] = useState(40);
  const [medicoBulk, setMedicoBulk] = useState<string>('');

  const grouped = useMemo(() => {
    const map = new Map<number, DispSlotInput[]>();
    for (const row of rows) {
      const list = map.get(row.dia_semana) ?? [];
      list.push(row);
      map.set(row.dia_semana, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    }
    return DIAS.filter((d) => map.has(d.v)).map((d) => ({
      dia: d.v,
      label: DIAS_FULL[d.v],
      slots: map.get(d.v)!,
    }));
  }, [rows]);

  function toggleDia(v: number) {
    setDiasSel((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b),
    );
  }

  function addHorarioPendente() {
    const t = `${horaH.padStart(2, '0')}:${horaM}`;
    setHorariosPendentes((prev) => (prev.includes(t) ? prev : [...prev, t].sort()));
  }

  function aplicarLote() {
    if (diasSel.length === 0) {
      alert('Marque pelo menos um dia da semana.');
      return;
    }
    const times =
      horariosPendentes.length > 0
        ? horariosPendentes
        : [`${horaH.padStart(2, '0')}:${horaM}`];
    const med =
      userType === 'clinica' && medicoBulk ? medicoBulk : null;
    const novos: DispSlotInput[] = [];
    for (const dia of diasSel) {
      for (const hi of times) {
        novos.push({
          medico_nome: med,
          dia_semana: dia,
          hora_inicio: hi,
          hora_fim: addMinutesToTime(hi, duracao),
          duracao_minutos: duracao,
        });
      }
    }
    const merged = normalizeDisponibilidadeForSave([...rows, ...novos]);
    onChange(merged);
    setHorariosPendentes([]);
  }

  function removeSlot(row: DispSlotInput) {
    const k = slotKey(row);
    onChange(rows.filter((r) => slotKey(r) !== k));
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Horários para agendamento online</h2>
        <p className="text-sm text-gray-500 mt-1">
          Marque os dias, escolha os horários nos menus e adicione de uma vez. Cada vaga some do
          link público depois que um paciente reservar.
        </p>
      </div>

      <div className="rounded-xl border-2 border-[#90EE90]/50 bg-[#fafffa] p-4 space-y-4">
        <p className="text-sm font-semibold text-[#013a01]">Adicionar horários em lote</p>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Dias da semana</p>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((d) => {
              const on = diasSel.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleDia(d.v)}
                  className={`min-w-[3rem] px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    on
                      ? 'border-[#228B22] bg-[#228B22] text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[#90EE90]'
                  }`}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setDiasSel(DIAS.map((d) => d.v))}
            className="text-xs text-[#228B22] mt-2 hover:underline"
          >
            Marcar todos
          </button>
          {' · '}
          <button
            type="button"
            onClick={() => setDiasSel([])}
            className="text-xs text-gray-500 hover:underline"
          >
            Limpar dias
          </button>
        </div>

        {userType === 'clinica' && medicos.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Médico (opcional)</label>
            <select
              value={medicoBulk}
              onChange={(e) => setMedicoBulk(e.target.value)}
              className="w-full max-w-xs text-sm rounded-lg border border-gray-200 px-3 py-2.5 bg-white"
            >
              <option value="">Todos os médicos</option>
              {medicos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Horário de início</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Hora</label>
              <select
                value={horaH}
                onChange={(e) => setHoraH(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 px-3 py-2.5 bg-white min-w-[5rem]"
              >
                {HORAS.map((h) => (
                  <option key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}h
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Min</label>
              <select
                value={horaM}
                onChange={(e) => setHoraM(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 px-3 py-2.5 bg-white min-w-[4.5rem]"
              >
                {MINUTOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Duração</label>
              <select
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                className="text-sm rounded-lg border border-gray-200 px-3 py-2.5 bg-white"
              >
                {DURACOES.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={addHorarioPendente}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-lg border border-[#228B22] text-[#228B22] text-sm font-medium bg-white hover:bg-[#f4fff4]"
            >
              <Plus className="w-4 h-4" />
              Incluir horário
            </button>
          </div>
        </div>

        {horariosPendentes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {horariosPendentes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-white border border-[#90EE90] text-sm font-medium text-gray-800"
              >
                {t}
                <button
                  type="button"
                  onClick={() =>
                    setHorariosPendentes((p) => p.filter((x) => x !== t))
                  }
                  className="p-1 rounded-full hover:bg-red-50 text-red-500"
                  aria-label={`Remover ${t}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={aplicarLote}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#013a01] text-white text-sm font-semibold hover:bg-[#025201]"
        >
          <Plus className="w-4 h-4" />
          Adicionar aos dias marcados
        </button>
        <p className="text-[11px] text-gray-500">
          Se a lista de horários estiver vazia, usa o horário selecionado acima (hora + min).
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-800 mb-3">Horários cadastrados</p>
        {grouped.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Nenhum horário ainda — use o bloco acima.
          </p>
        ) : (
          <ul className="space-y-3">
            {grouped.map(({ dia, label, slots }) => (
              <li
                key={dia}
                className="rounded-xl border border-gray-100 bg-[#fafafa] p-3"
              >
                <p className="text-xs font-bold text-gray-700 mb-2">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((row) => (
                    <span
                      key={slotKey(row)}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-white border border-gray-200 text-sm"
                    >
                      <span>
                        {row.hora_inicio.slice(0, 5)}
                        <span className="text-gray-400 text-xs ml-1">
                          ({row.duracao_minutos} min
                          {row.medico_nome ? ` · ${row.medico_nome}` : ''})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSlot(row)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        aria-label="Remover"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="w-full sm:w-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> Salvar horários
      </button>
    </section>
  );
}
