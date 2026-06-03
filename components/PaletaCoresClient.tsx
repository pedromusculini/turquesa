'use client';

import type { CorPapel, PaletaOpcao } from '@/lib/paletaCores';
import { CopyHexButton } from '@/components/PaletaCoresCopy';

function MiniMockSalon({ paleta }: { paleta: PaletaOpcao }) {
  const p = paleta.cores.primaria.hex;
  const s = paleta.cores.secundaria.hex;
  const d = paleta.cores.destaque.hex;
  const bg = paleta.cores.superficie.hex;

  return (
    <div
      className="mt-5 overflow-hidden rounded-2xl border border-black/5 shadow-inner"
      style={{ backgroundColor: bg }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ backgroundColor: p }}
      >
        <span className="text-sm font-bold tracking-tight">Turquesa Agenda</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
          style={{ backgroundColor: d, color: p }}
        >
          Hoje
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <span
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm"
            style={{ backgroundColor: s }}
          >
            Nova sessão
          </span>
          <span
            className="rounded-xl border-2 px-4 py-2 text-xs font-semibold"
            style={{ borderColor: s, color: p }}
          >
            Ver agenda
          </span>
        </div>
        <div
          className="rounded-xl border border-black/5 bg-white p-3 shadow-sm"
          style={{ borderColor: `${p}22` }}
        >
          <p className="text-[11px] font-semibold text-gray-900">Cliente — Corte + hidratação</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Profissional Ana · 14:30</p>
          <span
            className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${d}33`, color: p }}
          >
            Confirmada
          </span>
        </div>
      </div>
    </div>
  );
}

function SwatchRow({ papel, hex, label }: { papel: CorPapel; hex: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-11 w-11 shrink-0 rounded-xl border border-black/10 shadow-sm"
        style={{ backgroundColor: hex }}
        title={hex}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-[11px] text-gray-400 capitalize">{papel}</p>
      </div>
      <CopyHexButton hex={hex} />
    </div>
  );
}

export function PaletaCard({ paleta }: { paleta: PaletaOpcao }) {
  const ordem: CorPapel[] = ['primaria', 'secundaria', 'destaque', 'superficie'];

  return (
    <article className="flex flex-col rounded-3xl border border-gray-200/80 bg-white p-6 shadow-lg shadow-gray-900/5">
      <h2 className="text-xl font-bold text-gray-900">{paleta.nome}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{paleta.descricao}</p>
      <div className="mt-5 space-y-3">
        {ordem.map((papel) => {
          const c = paleta.cores[papel];
          return <SwatchRow key={papel} papel={papel} hex={c.hex} label={c.label} />;
        })}
      </div>
      <MiniMockSalon paleta={paleta} />
    </article>
  );
}
