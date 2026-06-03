'use client';

import { useState } from 'react';
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

const SVG_STROKE = { fill: 'none', stroke: '#0D9488', strokeWidth: 1.5, strokeLinecap: 'round' as const };

function IconSvgPreview({ keyName }: { keyName: string }) {
  switch (keyName) {
    case 'lash':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <ellipse cx="12" cy="13" rx="7" ry="4" {...SVG_STROKE} />
          <path d="M8 11v-4M10 10V5M12 9V4M14 10V5M16 11v-4" {...SVG_STROKE} />
        </svg>
      );
    case 'nail':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M8 18c0-4 2-8 4-10s4 2 4 10" {...SVG_STROKE} />
          <path d="M12 8v10" {...SVG_STROKE} />
        </svg>
      );
    case 'flower':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <circle cx="12" cy="12" r="2" fill="#0D9488" />
          <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" {...SVG_STROKE} />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M12 20C8 16 6 10 12 4c6 6 4 12 0 16z" {...SVG_STROKE} />
        </svg>
      );
    case 'eye':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...SVG_STROKE} />
          <circle cx="12" cy="12" r="2" fill="#0D9488" />
        </svg>
      );
    case 'brush':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M4 20l8-8M14 6l4 4M18 2l4 4-4 4" {...SVG_STROKE} />
        </svg>
      );
    case 'gem':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M6 9h12L12 3 6 9zm0 0v10l6 4 6-4V9" fill="#D4AF37" stroke="#D4AF37" />
        </svg>
      );
    case 'hand':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M8 14V8a2 2 0 114 0v6M12 14V6a2 2 0 114 0v8" {...SVG_STROKE} />
        </svg>
      );
    case 'droplet':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M12 3C8 9 6 12 6 16a6 6 0 1012 0c0-4-2-7-6-13z" fill="#0D9488" opacity={0.85} />
        </svg>
      );
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <circle cx="12" cy="12" r="4" fill="#D4A574" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M5 19l1.5-1.5" {...SVG_STROKE} />
        </svg>
      );
    case 'feather':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M4 20c8-2 12-8 16-16-8 4-14 8-16 16z" {...SVG_STROKE} />
        </svg>
      );
    case 'crown':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M3 18h18L12 6 3 18zm3-2h12l-6-5-6 5z" fill="#D4AF37" />
        </svg>
      );
    case 'mirror':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <ellipse cx="12" cy="10" rx="7" ry="9" {...SVG_STROKE} />
          <path d="M9 21h6" {...SVG_STROKE} />
        </svg>
      );
    case 'lipstick':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <rect x="9" y="4" width="6" height="8" rx="1" fill="#B76E79" />
          <path d="M8 12h8v8H8z" {...SVG_STROKE} />
        </svg>
      );
    case 'scissors':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <circle cx="6" cy="7" r="2" {...SVG_STROKE} />
          <circle cx="6" cy="17" r="2" {...SVG_STROKE} />
          <path d="M8 8l12 8M8 16l12-8" {...SVG_STROKE} />
        </svg>
      );
    case 'comb':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M6 6h12v3H6zM8 9v10M11 9v10M14 9v10M17 9v10" {...SVG_STROKE} />
        </svg>
      );
    case 'mono-ta':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#0D9488" />
          <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">
            TA
          </text>
        </svg>
      );
    case 'heart':
    case 'star':
    case 'sparkle':
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" fill="#0D9488" />
        </svg>
      );
  }
}

function FaviconPreview({ pack }: { pack: IconPackOpcao }) {
  if (pack.faviconTipo === 'emoji') {
    return (
      <span className="text-4xl" role="img" aria-label="favicon">
        {pack.faviconHint}
      </span>
    );
  }
  return (
    <div
      className="flex h-14 w-14 items-center justify-center rounded-xl border border-teal-200/80 bg-white [&_svg]:h-10 [&_svg]:w-10"
      dangerouslySetInnerHTML={{ __html: pack.faviconHint }}
    />
  );
}

function CopyFaviconButton({ pack }: { pack: IconPackOpcao }) {
  const [copied, setCopied] = useState(false);
  const label = pack.faviconTipo === 'emoji' ? pack.faviconHint : 'SVG favicon';

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(pack.faviconHint).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left font-mono text-[10px] text-gray-700 transition hover:bg-gray-100"
      title="Copiar snippet para favicon"
    >
      {copied ? 'Copiado!' : `Copiar favicon: ${label}`}
    </button>
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

export function IconPackCard({ pack }: { pack: IconPackOpcao }) {
  const isEmoji = pack.estilo === 'Emoji';
  const isLucide = pack.estilo === 'Lucide';

  return (
    <article className="flex flex-col rounded-3xl border border-gray-200/80 bg-white p-6 shadow-lg shadow-gray-900/5">
      <div className="flex flex-wrap items-center gap-2">
        <CodigoBadge codigo={pack.codigo} />
        <span className="text-xs text-gray-500">{pack.vertical}</span>
      </div>
      <h2 className="mt-3 text-xl font-bold text-gray-900">{pack.nome}</h2>
      <p className="mt-1 text-xs font-medium text-[#0D9488]">
        {pack.estilo} · uso: {pack.uso}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{pack.descricao}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-4 rounded-2xl bg-teal-50/60 p-5">
        {pack.icones.map((icone) =>
          isEmoji ? (
            <span key={icone} className="text-3xl" role="img" aria-label={icone}>
              {icone}
            </span>
          ) : isLucide ? (
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
      <div className="mt-4 rounded-xl border border-dashed border-teal-200/80 bg-teal-50/30 p-4">
        <p className="text-center text-xs font-semibold text-[#1B3A4B]">Preview favicon (32×32)</p>
        <div className="mt-3 flex justify-center">
          <FaviconPreview pack={pack} />
        </div>
        <CopyFaviconButton pack={pack} />
        {pack.faviconTipo === 'emoji' && (
          <p className="mt-2 text-center text-[10px] text-gray-500">
            Emoji como favicon: exporte PNG 32×32 ou use gerador (ex. favicon.io).
          </p>
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
  const champagne = '#D4AF37';

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
    case 'display-luxo':
      return (
        <p className="text-center" style={{ fontFamily: 'Georgia, serif' }}>
          <span className="block text-4xl font-bold tracking-tight text-[#1B3A4B]">Turquesa</span>
          <span className="block text-2xl font-light tracking-[0.15em]" style={{ color: turquesa }}>
            Agenda
          </span>
        </p>
      );
    case 'condensed-bold':
      return (
        <p className="text-center text-3xl font-black uppercase leading-none tracking-tight text-[#1B3A4B]">
          Turquesa
          <br />
          <span style={{ color: turquesa }}>Agenda</span>
        </p>
      );
    case 'italic-glam':
      return (
        <p className="text-center italic" style={{ fontFamily: 'Georgia, serif' }}>
          <span className="text-3xl font-semibold text-[#1B3A4B]">Turquesa</span>
          <span className="ml-2 text-2xl" style={{ color: champagne }}>
            Agenda
          </span>
        </p>
      );
    case 'underline-accent':
      return (
        <p className="text-center text-2xl font-semibold text-[#1B3A4B]">
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
        <p className="text-center text-lg font-bold tracking-[0.25em] text-[#1B3A4B]">
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
          <span className="text-[#1B3A4B]">Turquesa</span>{' '}
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
          <p className="text-xl font-semibold text-[#1B3A4B]">
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
