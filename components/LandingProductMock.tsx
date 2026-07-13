/**
 * Mock leve da Agenda (CSS) — evita vídeo pesado no LCP (tráfego Meta/mobile).
 * Dados fictícios realistas de salão; não é empty state.
 */
export function LandingAgendaMock({ compact = false }: { compact?: boolean }) {
  const rows = [
    { time: '09:00', name: 'Ana Souza', service: 'Coloração', pro: 'Rani', color: '#047482' },
    { time: '11:00', name: 'Letícia Bestel', service: 'Escova', pro: 'Marri', color: '#c69c6c' },
    { time: '14:30', name: 'Camila Dias', service: 'Manicure', pro: 'Rani', color: '#3795a1' },
    { time: '17:00', name: 'Juliana M.', service: 'Corte', pro: 'Rani', color: '#047482' },
  ];
  const shown = compact ? rows.slice(0, 3) : rows;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(4,116,130,0.12)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-[#F8FAFC] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#047482]" />
          <span className="text-xs font-semibold text-slate-800">Agenda · Terça</span>
        </div>
        <span className="text-[10px] font-medium text-[#3795a1]">Google Calendar</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {shown.map((r) => (
          <li key={r.time + r.name} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">
              {r.time}
            </span>
            <span
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">{r.name}</p>
              <p className="truncate text-[10px] text-slate-500">
                {r.service} · {r.pro}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingClientesMock() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(4,116,130,0.1)]"
      aria-hidden
    >
      <div className="border-b border-slate-100 bg-[#F8FAFC] px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-800">Cliente · Ana Souza</p>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-[11px] text-slate-600">Última sessão: coloração · Rani</p>
        <p className="text-[11px] text-slate-600">Próxima: terça 09:00</p>
        <div className="mt-2 rounded-xl bg-[#eef4f5] px-3 py-2 text-[11px] font-medium text-[#047482]">
          Lembrete pronto → abrir WhatsApp (wa.me)
        </div>
      </div>
    </div>
  );
}

export function LandingFinanceiroMock() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(4,116,130,0.1)]"
      aria-hidden
    >
      <div className="border-b border-slate-100 bg-[#F8FAFC] px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-800">Financeiro · Hoje</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="rounded-xl bg-[#eef4f5] p-2.5">
          <p className="text-[10px] text-slate-500">Entradas</p>
          <p className="text-sm font-bold text-[#047482]">R$ 1.280</p>
        </div>
        <div className="rounded-xl bg-[#faf6f0] p-2.5">
          <p className="text-[10px] text-slate-500">Repasse equipe</p>
          <p className="text-sm font-bold text-[#c69c6c]">R$ 512</p>
        </div>
      </div>
    </div>
  );
}
