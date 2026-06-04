import type { Metadata } from 'next';
import { ExternalLink, Palette } from 'lucide-react';
import { LogoClienteCard, LogoVariantCard, PaletaCard } from '@/components/PaletaCoresClient';
import {
  LOGO_CLIENTE_OPCOES,
  LOGO_VARIANTES_OPCOES,
  PALETAS_OPCOES,
  PALETA_CORES_SHARE_URL,
  PALETA_PROJETO_ATUAL,
} from '@/lib/paletaCores';
import { CopyHexButton } from '@/components/PaletaCoresCopy';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Turquesa Agenda — Portfólio de marca',
  description:
    'Portfólio visual: logomarcas da cliente, 5 paletas e 15 wordmarks de referência para salão de beleza.',
  robots: { index: false, follow: false },
};

export default function PaletaCoresPage() {
  const projeto = PALETA_PROJETO_ATUAL;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 via-white to-teal-50/50">
      <header className="border-b border-gray-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 py-10 text-center md:py-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#047482]/10 px-4 py-1.5 text-sm font-medium text-[#047482]">
            <Palette className="h-4 w-4" aria-hidden />
            Turquesa Agenda
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Portfólio de marca
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
            Salão de beleza, manicure, lash design e harmonização facial — logomarcas geradas pela
            cliente, 15 wordmarks de referência e 5 paletas. Copie os HEX ou informe os códigos
            (LOGO-CLIENTE-*, LOGO-*, PALETA-*).
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <div
          className="mb-10 rounded-2xl border border-[#3795a1]/30 bg-[#3795a1]/5 px-5 py-4 md:flex md:items-center md:justify-between md:gap-6"
          role="note"
        >
          <div>
            <p className="text-sm font-semibold text-[#047482]">Versão para compartilhar (GitHub)</p>
            <p className="mt-1 text-sm text-gray-600">
              Envie este link à cliente — funciona sem deploy na Vercel do Turquesa Agenda.
            </p>
          </div>
          <a
            href={PALETA_CORES_SHARE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#3795a1] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#035e6b] md:mt-0"
          >
            Abrir portfólio no GitHub
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>

        <section
          className="mb-14 rounded-3xl border-2 border-dashed border-[#3795a1]/40 bg-white/80 p-6 md:p-8"
          aria-labelledby="paleta-atual-titulo"
        >
          <h2 id="paleta-atual-titulo" className="text-lg font-bold text-gray-900">
            {projeto.titulo}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{projeto.nota}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(projeto.cores).map(([key, c]) => (
              <li
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-4"
              >
                <div
                  className="h-12 w-12 shrink-0 rounded-xl border border-black/10 shadow-sm"
                  style={{ backgroundColor: c.hex }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{c.label}</p>
                  <CopyHexButton hex={c.hex} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16" aria-labelledby="secao-logos-cliente">
          <h2 id="secao-logos-cliente" className="text-2xl font-bold text-gray-900">
            1 · Logomarcas geradas (cliente)
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Treze variações em PNG enviadas pela cliente — inclui recortes do composite Gemini
            (variações A/B/C). Informe o código LOGO-CLIENTE-* à equipe.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {LOGO_CLIENTE_OPCOES.map((logo) => (
              <LogoClienteCard key={logo.id} logo={logo} />
            ))}
          </div>
        </section>

        <section className="mb-16" aria-labelledby="secao-logos">
          <h2 id="secao-logos" className="text-2xl font-bold text-gray-900">
            2 · Logotipos de referência (wordmark)
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Quinze wordmarks de Turquesa Agenda — serif, sans, script, monograma, blush e mais.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {LOGO_VARIANTES_OPCOES.map((v) => (
              <LogoVariantCard key={v.id} variante={v} />
            ))}
          </div>
        </section>

        <section aria-labelledby="secao-paletas">
          <h2 id="secao-paletas" className="text-2xl font-bold text-gray-900">
            3 · Paletas de cores
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Cinco paletas completas com mock de agendamento de sessão, profissional e cliente.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {PALETAS_OPCOES.map((paleta) => (
              <PaletaCard key={paleta.id} paleta={paleta} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-[#047482] px-5 py-10 text-center text-white">
        <p className="mx-auto max-w-xl text-base font-medium leading-relaxed md:text-lg">
          Escolha um código de cada seção (logo, paleta) e envie à equipe
        </p>
        <p className="mt-4 text-sm text-white/70">
          Compartilhar:{' '}
          <a
            href={PALETA_CORES_SHARE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-white/90 underline decoration-white/30 hover:text-white"
          >
            GitHub HTML Preview
          </a>
          {' · '}
          Dev local: <span className="font-mono text-white/90">http://localhost:3000/paleta-cores</span>
        </p>
      </footer>
    </div>
  );
}
