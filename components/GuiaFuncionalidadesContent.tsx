'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, CircleHelp, ListOrdered } from 'lucide-react';
import { BRAND } from '@/lib/visual/brand';
import {
  GUIA_INTRO,
  GUIA_ORDEM_CONFIGURACAO,
  GUIA_SECOES,
} from '@/lib/guiaFuncionalidades';

const P = BRAND.colors.primary;

type Props = {
  /** Links internos do app (dashboard) em vez de só âncoras */
  modoApp?: boolean;
  onIniciarTour?: () => void;
};

export default function GuiaFuncionalidadesContent({ modoApp = false, onIniciarTour }: Props) {
  return (
    <div className={modoApp ? '' : 'bg-white'}>
      <header
        className={`px-6 py-14 md:py-20 ${modoApp ? 'rounded-2xl border border-gray-100 bg-gradient-to-br from-[var(--brand-bg-onboarding)] to-white' : ''}`}
      >
        <div className="mx-auto max-w-4xl">
          {!modoApp && (
            <Link href="/" className="text-sm font-medium text-[#047482] hover:underline">
              ← Voltar ao início
            </Link>
          )}
          {modoApp && (
            <Link href="/dashboard" className="text-sm font-medium text-[#047482] hover:underline">
              ← Voltar ao Dashboard
            </Link>
          )}
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${P}18` }}
            >
              <BookOpen className="h-6 w-6" style={{ color: P }} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">{GUIA_INTRO.titulo}</h1>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-gray-600">
                {GUIA_INTRO.subtitulo}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {modoApp && onIniciarTour && (
              <button
                type="button"
                onClick={onIniciarTour}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: P }}
              >
                <CircleHelp className="h-4 w-4" />
                Refazer tour guiado
              </button>
            )}
            {!modoApp && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: P }}
              >
                Testar grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <p className="mt-4 text-sm text-gray-500">{GUIA_INTRO.dicaTour}</p>
        </div>
      </header>

      <section className="border-b border-gray-100 bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-[#047482]">
            <ListOrdered className="h-5 w-5" />
            <h2 className="text-lg font-bold text-gray-900">Ordem sugerida de configuração</h2>
          </div>
          <ol className="mt-4 space-y-2">
            {GUIA_ORDEM_CONFIGURACAO.map((passo, i) => (
              <li key={passo} className="flex items-start gap-3 text-sm text-gray-700">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: P }}
                >
                  {i + 1}
                </span>
                {passo}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <nav
        className="sticky top-[73px] z-30 border-b border-gray-100 bg-white/95 px-6 py-3 backdrop-blur"
        aria-label="Índice do guia"
      >
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto pb-1 text-sm">
          {GUIA_SECOES.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-600 transition hover:border-[#047482]/40 hover:text-[#047482]"
            >
              {sec.titulo}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="space-y-16">
          {GUIA_SECOES.map((sec) => {
            const Icon = sec.Icon;
            return (
              <article
                key={sec.id}
                id={sec.id}
                className="scroll-mt-36 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-8"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${P}12` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: P }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold text-gray-900">{sec.titulo}</h2>
                    <p className="mt-1 text-gray-600">{sec.resumo}</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-8 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                      O que você pode fazer
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {sec.oQueFaz.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#047482]"
                            aria-hidden
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl bg-[var(--brand-bg-onboarding)]/60 p-5">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#047482]">
                      Como configurar
                    </h3>
                    <ol className="mt-3 space-y-2">
                      {sec.comoConfigurar.map((passo, i) => (
                        <li key={passo.texto} className="flex gap-2 text-sm text-gray-800">
                          <span className="font-semibold text-[#047482]">{i + 1}.</span>
                          {passo.texto}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {modoApp && sec.rotaApp && (
                  <Link
                    href={sec.rotaApp}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#047482] hover:underline"
                  >
                    {sec.rotaAppLabel ?? 'Abrir no app'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
