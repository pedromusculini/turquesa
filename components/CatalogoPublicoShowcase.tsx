'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

type ServicoVitrine = {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco_centavos: number;
  foto_urls: string[];
};

type Props = {
  token: string;
};

export default function CatalogoPublicoShowcase({ token }: Props) {
  const [servicos, setServicos] = useState<ServicoVitrine[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    fetch(`/api/public/catalogo?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setHidden(true);
          return;
        }
        setServicos(data.servicos ?? []);
        if (!data.servicos?.length) setHidden(true);
      })
      .catch(() => setHidden(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (hidden) return null;

  if (loading) {
    return (
      <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-[#228B22]" />
        Carregando catálogo...
      </div>
    );
  }

  return (
    <section className="mb-8" aria-labelledby="catalogo-vitrine-titulo">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#228B22]" aria-hidden />
        <h2 id="catalogo-vitrine-titulo" className="text-lg font-semibold text-gray-900">
          Catálogo de serviços
        </h2>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Conheça os serviços oferecidos — valores e duração para referência.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {servicos.map((s) => (
          <li
            key={s.id}
            className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
          >
            {s.foto_urls.length > 0 ? (
              <div className="flex gap-0.5">
                {s.foto_urls.map((url) => (
                  <div key={url} className="relative h-32 flex-1 bg-gray-100">
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
              <div className="flex h-20 items-center justify-center bg-teal-50/60 text-xs text-gray-400">
                Sem foto
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">{s.nome}</h3>
              <p className="mt-1 text-sm text-gray-600">
                {s.duracao_minutos} min ·{' '}
                <span className="font-medium text-gray-900">
                  {formatCurrency(s.preco_centavos / 100)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
