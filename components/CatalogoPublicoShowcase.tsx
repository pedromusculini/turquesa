'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

type ServicoVitrine = {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco_centavos: number;
  foto_urls: string[];
};

type Props =
  | {
      token: string;
      mode?: 'select';
      selectedId: string | null;
      onSelect: (id: string | null) => void;
    }
  | {
      token: string;
      mode: 'vitrine';
      selectedId?: never;
      onSelect?: never;
    };

export default function CatalogoPublicoShowcase(props: Props) {
  const { token, mode = 'select' } = props;
  const vitrine = mode === 'vitrine';
  const [servicos, setServicos] = useState<ServicoVitrine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const selectedId = !vitrine ? props.selectedId : null;
  const onSelect = !vitrine ? props.onSelect : undefined;

  useEffect(() => {
    fetch(`/api/public/catalogo?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          if (vitrine) setLoadError(data.error);
          else setHidden(true);
          return;
        }
        setServicos(data.servicos ?? []);
        if (!data.servicos?.length) {
          if (vitrine) setLoadError('Nenhum serviço disponível no catálogo no momento.');
          else setHidden(true);
        }
      })
      .catch(() => {
        if (vitrine) setLoadError('Não foi possível carregar o catálogo.');
        else setHidden(true);
      })
      .finally(() => setLoading(false));
  }, [token, vitrine]);

  if (!vitrine && hidden) return null;

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50 py-6 text-sm text-gray-500 ${vitrine ? '' : 'mb-6'}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-[#047482]" />
        Carregando catálogo...
      </div>
    );
  }

  if (vitrine && loadError) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-red-600 text-sm">{loadError}</p>
      </div>
    );
  }

  if (!vitrine && hidden) return null;

  return (
    <section className={vitrine ? '' : 'mb-8'} aria-labelledby="catalogo-vitrine-titulo">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#047482]" aria-hidden />
        <h1
          id="catalogo-vitrine-titulo"
          className={`font-semibold text-gray-900 ${vitrine ? 'text-2xl' : 'text-lg'}`}
        >
          Catálogo de serviços
        </h1>
      </div>
      {!vitrine && (
        <p className="mb-3 text-sm text-gray-500">
          Escolha um serviço de interesse (opcional) — valores e duração para referência.
        </p>
      )}
      {vitrine && (
        <p className="mb-4 text-sm text-gray-500">
          Valores e duração dos serviços — apenas consulta.
        </p>
      )}
      {!vitrine && selectedId && onSelect && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mb-3 text-xs font-medium text-[#047482] hover:underline"
        >
          Limpar seleção
        </button>
      )}
      <div
        className={`max-h-[min(420px,55vh)] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-2 pr-1 ${vitrine ? 'max-h-none' : ''}`}
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {servicos.map((s) => {
            const selected = selectedId === s.id;
            const cardInner = (
              <>
                {s.foto_urls.length > 0 ? (
                  <div className="flex gap-0.5">
                    {s.foto_urls.map((url) => (
                      <div key={url} className="relative h-28 flex-1 bg-gray-100">
                        <Image
                          src={url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 240px"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-16 items-center justify-center bg-[var(--brand-bg-onboarding)] text-xs text-gray-400">
                    Sem foto
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 p-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.nome}</h3>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {s.duracao_minutos} min ·{' '}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(s.preco_centavos / 100)}
                      </span>
                    </p>
                  </div>
                  {selected && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#047482] text-white">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </div>
              </>
            );

            if (vitrine) {
              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
                >
                  {cardInner}
                </li>
              );
            }

            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect!(selected ? null : s.id)}
                  className={`w-full overflow-hidden rounded-xl border text-left transition-shadow ${
                    selected
                      ? 'border-[#047482] bg-white ring-2 ring-[#047482]/30 shadow-md'
                      : 'border-gray-100 bg-white shadow-sm hover:border-gray-200'
                  }`}
                >
                  {cardInner}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
