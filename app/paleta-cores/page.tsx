import type { Metadata } from 'next';
import { ExternalLink, Palette } from 'lucide-react';
import { PaletaCard } from '@/components/PaletaCoresClient';
import { PALETAS_OPCOES, PALETA_CORES_SHARE_URL, PALETA_PROJETO_ATUAL } from '@/lib/paletaCores';
import { CopyHexButton } from '@/components/PaletaCoresCopy';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Turquesa Agenda — Paletas de cores',
  description:
    'Portfólio visual de paletas para o Turquesa Agenda. Escolha os 4 códigos HEX e envie à equipe.',
  robots: { index: false, follow: false },
};

export default function PaletaCoresPage() {
  const projeto = PALETA_PROJETO_ATUAL;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-teal-50/40">
      <header className="border-b border-gray-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 py-10 text-center md:py-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#1B3A4B]/10 px-4 py-1.5 text-sm font-medium text-[#1B3A4B]">
            <Palette className="h-4 w-4" aria-hidden />
            Turquesa Agenda
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Paletas de cores
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
            Opções baseadas nas famílias petróleo, turquesa, ciano e ocre. Toque no código HEX para
            copiar. Nenhum login necessário.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <div
          className="mb-10 rounded-2xl border border-[#0D9488]/30 bg-[#0D9488]/5 px-5 py-4 md:flex md:items-center md:justify-between md:gap-6"
          role="note"
        >
          <div>
            <p className="text-sm font-semibold text-[#1B3A4B]">Versão para compartilhar (GitHub)</p>
            <p className="mt-1 text-sm text-gray-600">
              Envie este link à cliente — funciona sem deploy na Vercel do Turquesa Agenda.
            </p>
          </div>
          <a
            href={PALETA_CORES_SHARE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f766e] md:mt-0"
          >
            Abrir portfólio no GitHub
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>

        <section
          className="mb-14 rounded-3xl border-2 border-dashed border-[#0D9488]/40 bg-white/80 p-6 md:p-8"
          aria-labelledby="paleta-atual-titulo"
        >
          <h2 id="paleta-atual-titulo" className="text-lg font-bold text-gray-900">
            {projeto.titulo}
          </h2>
          <p className="mt-2 text-sm text-amber-800/90">{projeto.nota}</p>
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

        <div className="grid gap-8 md:grid-cols-2">
          {PALETAS_OPCOES.map((paleta) => (
            <PaletaCard key={paleta.id} paleta={paleta} />
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-[#1B3A4B] px-5 py-10 text-center text-white">
        <p className="mx-auto max-w-xl text-base font-medium leading-relaxed md:text-lg">
          Escolha uma opção e envie os 4 códigos HEX para a equipe
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
