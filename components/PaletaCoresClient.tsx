'use client';

import type { CorPapel, IconPackOpcao, LogoVarianteOpcao, PaletaOpcao } from '@/lib/paletaCores';
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
          <p className="text-[11px] font-semibold text-gray-900">Cliente — Alongamento + esmaltação</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Profissional Ana · 14:30</p>
          <span
            className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${d}55`, color: p }}
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
        <p className="text-[11px] capitalize text-gray-400">{papel}</p>
      </div>
      <CopyHexButton hex={hex} />
    </div>
  );
}

function CodigoBadge({ codigo }: { codigo: string }) {
  return (
    <span className="inline-flex rounded-lg bg-[#1B3A4B]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#1B3A4B]">
      {codigo}
    </span>
  );
}

function IconSvgPreview({ keyName }: { keyName: string }) {
  const stroke = '#0D9488';
  const common = { fill: 'none', stroke, strokeWidth: 1.5, strokeLinecap: 'round' as const };

  switch (keyName) {
    case 'lash':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <ellipse cx="12" cy="13" rx="7" ry="4" {...common} />
          <path d="M8 11v-4M10 10V5M12 9V4M14 10V5M16 11v-4" {...common} />
        </svg>
      );
    case 'nail':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M8 18c0-4 2-8 4-10s4 2 4 10" {...common} />
          <path d="M12 8v10" {...common} />
        </svg>
      );
    case 'flower':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <circle cx="12" cy="12" r="2" fill={stroke} />
          <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" {...common} />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M12 20C8 16 6 10 12 4c6 6 4 12 0 16z" {...common} />
        </svg>
      );
    case 'eye':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...common} />
          <circle cx="12" cy="12" r="2" fill={stroke} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" fill={stroke} />
        </svg>
      );
  }
}

export function PaletaCard({ paleta }: { paleta: PaletaOpcao }) {
  const ordem: CorPapel[] = ['primaria', 'secundaria', 'destaque', 'superficie'];

  return (
    <article className="flex flex-col rounded-3xl border border-gray-200/80 bg-white p-6 shadow-lg shadow-gray-900/5">
      <div className="flex flex-wrap items-center gap-2">
        <CodigoBadge codigo={paleta.codigo} />
        <span className="text-xs text-gray-500">{paleta.vertical}</span>
      </div>
      <h2 className="mt-3 text-xl font-bold text-gray-900">{paleta.nome}</h2>
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

export function IconPackCard({ pack }: { pack: IconPackOpcao }) {
  const isEmoji = pack.estilo === 'Emoji';

  return (
    <article className="flex flex-col rounded-3xl border border-gray-200/80 bg-white p-6 shadow-lg shadow-gray-900/5">
      <div className="flex flex-wrap items-center gap-2">
        <CodigoBadge codigo={pack.codigo} />
        <span className="text-xs text-gray-500">{pack.vertical}</span>
      </div>
      <h2 className="mt-3 text-xl font-bold text-gray-900">{pack.nome}</h2>
      <p className="mt-1 text-xs font-medium text-[#0D9488]">{pack.estilo}</p>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{pack.descricao}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-4 rounded-2xl bg-teal-50/60 p-5">
        {pack.icones.map((icone) =>
          isEmoji ? (
            <span key={icone} className="text-3xl" role="img" aria-label={icone}>
              {icone}
            </span>
          ) : pack.estilo === 'Lucide' ? (
            <span
              key={icone}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-teal-200/80 bg-white text-[10px] font-bold text-[#0D9488]"
            >
              {icone.slice(0, 2)}
            </span>
          ) : (
            <span
              key={icone}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-teal-200/80 bg-white"
            >
              <IconSvgPreview keyName={icone} />
            </span>
          ),
        )}
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">
        Informe <strong className="font-mono text-gray-700">{pack.codigo}</strong> à equipe
      </p>
    </article>
  );
}

function LogoPreview({ variante }: { variante: LogoVarianteOpcao }) {
  const turquesa = '#0D9488';
  const rose = '#B76E79';
  const petroleo = '#1B3A4B';

  switch (variante.tratamento) {
    case 'serif-elegante':
      return (
        <p className="text-center leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
          <span className="text-2xl font-semibold text-[#1B3A4B]">Turquesa</span>
          <br />
          <span className="text-xl tracking-[0.2em]" style={{ color: turquesa }}>
            AGENDA
          </span>
        </p>
      );
    case 'sans-moderno':
      return (
        <p className="text-center text-2xl font-bold uppercase tracking-[0.35em] text-[#1B3A4B]">
          Turquesa <span style={{ color: turquesa }}>Agenda</span>
        </p>
      );
    case 'script-luxo':
      return (
        <p className="text-center leading-none">
          <span className="text-4xl" style={{ fontFamily: 'cursive', color: rose }}>
            Turquesa
          </span>
          <span className="mt-1 block text-sm font-medium tracking-widest text-gray-500">
            agenda
          </span>
        </p>
      );
    case 'stacked':
      return (
        <p className="text-center leading-tight">
          <span className="block text-lg font-semibold text-[#1B3A4B]">TURQUESA</span>
          <span className="block text-2xl font-bold" style={{ color: turquesa }}>
            Agenda
          </span>
        </p>
      );
    case 'monograma':
      return (
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${turquesa}, ${petroleo})` }}
        >
          TA
        </div>
      );
    default:
      return null;
  }
}

export function LogoVariantCard({ variante }: { variante: LogoVarianteOpcao }) {
  return (
    <article className="flex flex-col rounded-3xl border border-gray-200/80 bg-white p-6 shadow-lg shadow-gray-900/5">
      <div className="flex flex-wrap items-center gap-2">
        <CodigoBadge codigo={variante.codigo} />
        <span className="text-xs text-gray-500">{variante.vertical}</span>
      </div>
      <h2 className="mt-3 text-xl font-bold text-gray-900">{variante.nome}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{variante.descricao}</p>
      <div className="mt-6 flex min-h-[7rem] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-white to-teal-50/40 px-4 py-8">
        <LogoPreview variante={variante} />
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">
        Informe <strong className="font-mono text-gray-700">{variante.codigo}</strong> à equipe
      </p>
    </article>
  );
}
