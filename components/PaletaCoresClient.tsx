'use client';

import type { CorPapel, LogoClienteOpcao, LogoVarianteOpcao, PaletaOpcao } from '@/lib/paletaCores';
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
    <span className="inline-flex rounded-lg bg-[#047482]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#047482]">
      {codigo}
    </span>
  );
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

function LogoPreview({ variante }: { variante: LogoVarianteOpcao }) {
  const turquesa = '#3795a1';
  const rose = '#B76E79';
  const petroleo = '#047482';
  const champagne = '#D4AF37';

  switch (variante.tratamento) {
    case 'serif-elegante':
      return (
        <p className="text-center leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
          <span className="text-2xl font-semibold text-[#047482]">Turquesa</span>
          <br />
          <span className="text-xl tracking-[0.2em]" style={{ color: turquesa }}>
            AGENDA
          </span>
        </p>
      );
    case 'sans-moderno':
      return (
        <p className="text-center text-2xl font-bold uppercase tracking-[0.35em] text-[#047482]">
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
          <span className="block text-lg font-semibold text-[#047482]">TURQUESA</span>
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
    case 'display-luxo':
      return (
        <p className="text-center" style={{ fontFamily: 'Georgia, serif' }}>
          <span className="block text-4xl font-bold tracking-tight text-[#047482]">Turquesa</span>
          <span className="block text-2xl font-light tracking-[0.15em]" style={{ color: turquesa }}>
            Agenda
          </span>
        </p>
      );
    case 'condensed-bold':
      return (
        <p className="text-center text-3xl font-black uppercase leading-none tracking-tight text-[#047482]">
          Turquesa
          <br />
          <span style={{ color: turquesa }}>Agenda</span>
        </p>
      );
    case 'italic-glam':
      return (
        <p className="text-center italic" style={{ fontFamily: 'Georgia, serif' }}>
          <span className="text-3xl font-semibold text-[#047482]">Turquesa</span>
          <span className="ml-2 text-2xl" style={{ color: champagne }}>
            Agenda
          </span>
        </p>
      );
    case 'underline-accent':
      return (
        <p className="text-center text-2xl font-semibold text-[#047482]">
          Turquesa Agenda
          <span
            className="mx-auto mt-1 block h-1 w-24 rounded-full"
            style={{ backgroundColor: turquesa }}
          />
        </p>
      );
    case 'blush-gradient':
      return (
        <p
          className="bg-gradient-to-r from-[#B76E79] to-[#F4C2C2] bg-clip-text text-center text-3xl font-bold text-transparent"
          style={{ fontFamily: 'cursive' }}
        >
          Turquesa Agenda
        </p>
      );
    case 'caps-lockup':
      return (
        <p className="text-center text-lg font-bold tracking-[0.25em] text-[#047482]">
          TURQUESA AGENDA
        </p>
      );
    case 'circle-badge':
      return (
        <div
          className="mx-auto flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 text-center"
          style={{ borderColor: turquesa, color: petroleo }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest">Turquesa</span>
          <span className="text-sm font-semibold" style={{ color: turquesa }}>
            Agenda
          </span>
        </div>
      );
    case 'split-color':
      return (
        <p className="text-center text-2xl font-bold">
          <span className="text-[#047482]">Turquesa</span>{' '}
          <span style={{ color: turquesa }}>Agenda</span>
        </p>
      );
    case 'handwritten-duo':
      return (
        <p className="text-center text-3xl" style={{ fontFamily: 'cursive', color: rose }}>
          Turquesa Agenda
        </p>
      );
    case 'diamond-wordmark':
      return (
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden>
            <path d="M6 9h12L12 3 6 9zm0 0v10l6 4 6-4V9" fill={champagne} />
          </svg>
          <p className="text-xl font-semibold text-[#047482]">
            Turquesa <span style={{ color: turquesa }}>Agenda</span>
          </p>
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

export function LogoClienteCard({ logo }: { logo: LogoClienteOpcao }) {
  return (
    <article className="flex flex-col rounded-3xl border border-gray-200/80 bg-white p-6 shadow-lg shadow-gray-900/5">
      <div className="flex flex-wrap items-center gap-2">
        <CodigoBadge codigo={logo.codigo} />
        <span className="text-xs text-gray-500">{logo.vertical}</span>
      </div>
      <h2 className="mt-3 text-xl font-bold text-gray-900">{logo.nome}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{logo.descricao}</p>
      <div className="mt-6 flex min-h-[7rem] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] px-4 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- portfólio estático de PNGs da cliente */}
        <img
          src={logo.imagem}
          alt={logo.nome}
          className="max-h-40 w-full max-w-full object-contain"
          loading="lazy"
        />
      </div>
      {logo.cores && logo.cores.length > 0 && (
        <div className="mt-4 space-y-2">
          {logo.cores.map((c) => (
            <div key={c.hex} className="flex items-center gap-3">
              <div
                className="h-8 w-8 shrink-0 rounded-lg border border-black/10 shadow-sm"
                style={{ backgroundColor: c.hex }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
              <CopyHexButton hex={c.hex} />
            </div>
          ))}
        </div>
      )}
      {logo.nota && <p className="mt-3 text-xs text-gray-400">{logo.nota}</p>}
      <p className="mt-4 text-center text-xs text-gray-500">
        Informe <strong className="font-mono text-gray-700">{logo.codigo}</strong> à equipe
      </p>
    </article>
  );
}
