'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import CatalogoPublicoShowcase from '@/components/CatalogoPublicoShowcase';
import {
  LANDING_PALETA_META,
  LANDING_TEXTO_PADRAO,
  landingAppPath,
  paletteCssVars,
  type LandingPublicData,
} from '@/lib/salonLanding';

type Props = {
  data: LandingPublicData;
  preview?: boolean;
};

function Ctas({ data }: { data: LandingPublicData }) {
  const { blocos, urls } = data;
  return (
    <div className="flex flex-wrap gap-2">
      {blocos.agendar ? (
        <Link
          href={landingAppPath(urls.agendar)}
          className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
          style={{ background: 'var(--lp-brand)', color: 'var(--lp-btn)' }}
        >
          Agendar horário
        </Link>
      ) : null}
      {blocos.cadastro && urls.cadastro ? (
        <Link
          href={landingAppPath(urls.cadastro)}
          className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-semibold"
          style={{
            background: 'var(--lp-glass)',
            color: 'var(--lp-ink)',
            borderColor: 'var(--lp-stroke)',
            backdropFilter: 'blur(12px)',
          }}
        >
          Primeira visita
        </Link>
      ) : null}
    </div>
  );
}

function Experiencia({ data }: { data: LandingPublicData }) {
  if (!data.blocos.experiencia) return null;
  const texto = data.textoExperiencia.trim() || LANDING_TEXTO_PADRAO;
  return (
    <div className="space-y-1">
      <p
        className="text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: 'var(--lp-accent)' }}
      >
        Da dona
      </p>
      <p className="max-w-xl text-[0.95rem] leading-relaxed" style={{ color: 'var(--lp-muted)' }}>
        {texto}
      </p>
    </div>
  );
}

function EquipeEndereco({ data }: { data: LandingPublicData }) {
  const showEquipe = data.blocos.equipe && data.equipe.length > 0;
  const showEndereco = data.blocos.endereco;
  if (!showEquipe && !showEndereco) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showEquipe ? (
        <div>
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: 'var(--lp-accent)' }}
          >
            Quem atende
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--lp-ink)' }}>
            {data.equipe.map((p) => p.nome).join(' · ')}
          </p>
        </div>
      ) : (
        <div />
      )}
      {showEndereco ? (
        <div id="lp-onde" className="scroll-mt-4">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: 'var(--lp-accent)' }}
          >
            Endereço
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--lp-muted)' }}>
            {data.endereco}
          </p>
          {data.mapsUrl ? (
            <a
              href={data.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--lp-brand-2)' }}
            >
              Ver no mapa
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Nav({ data }: { data: LandingPublicData }) {
  const linkStyle = { color: 'inherit' as const };
  return (
    <nav className="flex items-center justify-between gap-3 px-5 py-4">
      <span
        className="truncate text-xs font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--lp-ink)' }}
      >
        {data.nome}
      </span>
      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--lp-muted)' }}>
        {data.blocos.catalogo ? (
          <a
            href="#lp-servicos"
            className="hover:underline"
            style={linkStyle}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('lp-servicos');
            }}
          >
            Serviços
          </a>
        ) : null}
        {data.blocos.endereco ? (
          <a
            href="#lp-onde"
            className="hover:underline"
            style={linkStyle}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('lp-onde');
            }}
          >
            Onde
          </a>
        ) : null}
        {data.blocos.agendar ? (
          <Link
            href={landingAppPath(data.urls.agendar)}
            className="font-semibold hover:underline"
            style={{ color: 'var(--lp-brand)' }}
          >
            Agendar
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function coverStyle(data: LandingPublicData): CSSProperties {
  const paleta = LANDING_PALETA_META[data.paleta];
  if (data.capaUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, transparent 25%, color-mix(in srgb, ${paleta.surface} 55%, transparent) 100%), url(${JSON.stringify(data.capaUrl)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {
    background: `linear-gradient(160deg, ${paleta.brand} 0%, ${paleta.brand2} 55%, ${paleta.accent} 100%)`,
  };
}

export default function SalaoLandingView({ data, preview }: Props) {
  const vars = paletteCssVars(data.paleta);
  const cover = coverStyle(data);
  const inner = (
    <article
      className="overflow-hidden"
      style={{
        background: 'var(--lp-surface)',
        color: 'var(--lp-ink)',
        border: preview ? '1px solid var(--lp-stroke)' : undefined,
        borderRadius: preview ? 28 : undefined,
      }}
    >
      <Nav data={data} />

      {data.estilo === 'editorial' ? (
        <>
          <div className="flex min-h-[280px] items-end p-6" style={cover}>
            <div
              className="max-w-lg rounded-2xl p-5"
              style={{
                background: 'var(--lp-glass)',
                border: '1px solid var(--lp-stroke)',
                backdropFilter: 'blur(18px) saturate(1.3)',
              }}
            >
              <p
                className="text-[11px] font-medium uppercase tracking-[0.14em]"
                style={{ color: 'var(--lp-accent)' }}
              >
                {data.nome}
              </p>
              <h1 className="mt-1 font-serif text-3xl leading-tight tracking-tight">
                Sua cadeira. Seu horário.
              </h1>
            </div>
          </div>
          <div className="space-y-5 p-6">
            <Experiencia data={data} />
            <Ctas data={data} />
          </div>
        </>
      ) : null}

      {data.estilo === 'vidro' ? (
        <div className="flex min-h-[460px] items-center p-6" style={cover}>
          <div
            className="max-w-md space-y-4 rounded-2xl p-7"
            style={{
              background: 'var(--lp-glass)',
              border: '1px solid var(--lp-stroke)',
              backdropFilter: 'blur(26px) saturate(1.4)',
            }}
          >
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: 'var(--lp-accent)' }}
            >
              Studio vidro
            </p>
            <h1 className="font-serif text-4xl leading-[0.95] tracking-tight">
              Marque sozinha. A gente atende.
            </h1>
            <Experiencia data={data} />
            <Ctas data={data} />
          </div>
        </div>
      ) : null}

      {data.estilo === 'atelie' ? (
        <div className="grid md:grid-cols-2">
          <div className="min-h-[280px] md:min-h-[520px]" style={cover} />
          <div className="space-y-5 p-6">
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: 'var(--lp-accent)' }}
            >
              {data.nome}
            </p>
            <h1 className="font-serif text-3xl leading-tight tracking-tight">
              Mãos no serviço. Você escolhe quando.
            </h1>
            <Experiencia data={data} />
            <Ctas data={data} />
          </div>
        </div>
      ) : null}

      <div className="space-y-6 p-6" style={{ background: 'var(--lp-surface)' }}>
        {data.blocos.catalogo ? (
          <div id="lp-servicos" className="salon-landing-catalogo scroll-mt-4">
            {data.catalogoToken ? (
              <CatalogoPublicoShowcase token={data.catalogoToken} mode="vitrine" />
            ) : null}
          </div>
        ) : null}
        <EquipeEndereco data={data} />
      </div>
    </article>
  );

  if (preview) {
    return (
      <div className="overflow-hidden rounded-[28px]" style={vars as CSSProperties}>
        {inner}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ ...vars, background: 'var(--lp-bg)' } as CSSProperties}>
      <div className="mx-auto max-w-3xl">{inner}</div>
      <p className="py-8 text-center text-xs" style={{ color: 'var(--lp-muted)' }}>
        Agenda pelo Turquesa Agenda
      </p>
    </div>
  );
}
