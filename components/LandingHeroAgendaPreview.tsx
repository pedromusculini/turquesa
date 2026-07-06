import { Calendar } from 'lucide-react';

const SESSOES = [
  {
    hora: '09:00',
    cliente: 'Ana Paula',
    servico: 'Coloração',
    profissional: 'Marina',
    cor: '#047482',
  },
  {
    hora: '10:30',
    cliente: 'Carla Mendes',
    servico: 'Corte + escova',
    profissional: 'Juliana',
    cor: '#3795a1',
  },
  {
    hora: '14:00',
    cliente: 'Fernanda R.',
    servico: 'Manicure',
    profissional: 'Patrícia',
    cor: '#c69c6c',
  },
  {
    hora: '16:00',
    cliente: 'Beatriz Lima',
    servico: 'Hidratação',
    profissional: 'Marina',
    cor: '#047482',
  },
] as const;

/**
 * Prévia estática da agenda — referência visual do produto no hero, sem screenshot genérico.
 */
export default function LandingHeroAgendaPreview() {
  return (
    <div
      className="rounded-2xl border border-white/25 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)] md:rounded-3xl md:p-6"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Agenda da equipe
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900 md:text-xl">7–11 de julho</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#D9F0F2] px-3 py-1 text-xs font-semibold text-[#047482]">
          12 sessões
        </span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {SESSOES.map((item) => (
          <li
            key={`${item.hora}-${item.cliente}`}
            className="flex items-stretch gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          >
            <span className="w-11 shrink-0 pt-0.5 text-sm font-bold tabular-nums text-slate-700">
              {item.hora}
            </span>
            <span
              className="w-1 shrink-0 rounded-full"
              style={{ backgroundColor: item.cor }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{item.cliente}</p>
              <p className="truncate text-xs text-slate-600">
                {item.servico}
                <span className="text-slate-400"> · </span>
                {item.profissional}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-xs text-slate-600">
        <Calendar className="h-4 w-4 shrink-0 text-[#047482]" aria-hidden />
        <span>Sincronizado com Google Calendar da equipe</span>
      </div>
    </div>
  );
}
