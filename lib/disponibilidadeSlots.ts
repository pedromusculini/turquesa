/** Horários de agendamento público: um registro = um horário fixo (ex. 08:00, 40 min). */

export type DispSlotInput = {
  medico_nome: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
};

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
}

export function addMinutesToTime(hhmm: string, minutes: number): string {
  return minutesToTimeString(parseTimeToMinutes(hhmm.slice(0, 5)) + minutes);
}

/** Converte linha do banco em slot único ou expande intervalos antigos para a UI. */
export function expandDisponibilidadeForUi(
  rows: Array<{
    medico_nome?: string | null;
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
    duracao_minutos?: number;
  }>,
): DispSlotInput[] {
  const out: DispSlotInput[] = [];

  for (const row of rows) {
    const dur = row.duracao_minutos ?? 40;
    const start = parseTimeToMinutes(String(row.hora_inicio).slice(0, 5));
    const end = parseTimeToMinutes(String(row.hora_fim).slice(0, 5));
    const span = end - start;
    const medico = row.medico_nome ?? null;

    if (span <= dur + 2) {
      const hi = minutesToTimeString(start);
      out.push({
        medico_nome: medico,
        dia_semana: row.dia_semana,
        hora_inicio: hi,
        hora_fim: addMinutesToTime(hi, dur),
        duracao_minutos: dur,
      });
      continue;
    }

    for (let t = start; t + dur <= end; t += dur) {
      const hi = minutesToTimeString(t);
      out.push({
        medico_nome: medico,
        dia_semana: row.dia_semana,
        hora_inicio: hi,
        hora_fim: addMinutesToTime(hi, dur),
        duracao_minutos: dur,
      });
    }
  }

  return out.sort((a, b) => {
    if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });
}

/** Persistência: cada linha da UI vira um slot fixo (fim = início + duração). */
export function normalizeDisponibilidadeForSave(
  rows: DispSlotInput[],
): DispSlotInput[] {
  const seen = new Set<string>();
  const out: DispSlotInput[] = [];

  for (const row of rows) {
    const hi = row.hora_inicio.slice(0, 5);
    const dur = row.duracao_minutos || 40;
    if (!hi) continue;
    const key = `${row.dia_semana}|${hi}|${dur}|${row.medico_nome ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      medico_nome: row.medico_nome,
      dia_semana: row.dia_semana,
      hora_inicio: hi,
      hora_fim: addMinutesToTime(hi, dur),
      duracao_minutos: dur,
    });
  }

  return out;
}
