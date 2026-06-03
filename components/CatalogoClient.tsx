'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CatalogoServicosClient from '@/components/CatalogoServicosClient';
import CatalogoProfissionaisClient from '@/components/CatalogoProfissionaisClient';

type Tab = 'servicos' | 'profissionais';

function CatalogoTabsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'profissionais' ? 'profissionais' : 'servicos';

  const setTab = useCallback(
    (next: Tab) => {
      const q = new URLSearchParams(searchParams.toString());
      if (next === 'servicos') q.delete('tab');
      else q.set('tab', next);
      const qs = q.toString();
      router.replace(`/dashboard/catalogo${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, searchParams],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'servicos', label: 'Serviços' },
    { id: 'profissionais', label: 'Profissionais' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Serviços do salão e equipe de profissionais.
        </p>
      </div>

      <div
        className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1"
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'servicos' ? (
        <CatalogoServicosClient embedded />
      ) : (
        <CatalogoProfissionaisClient />
      )}
    </div>
  );
}

export default function CatalogoClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-sm text-gray-500">Carregando catálogo...</p>
        </div>
      }
    >
      <CatalogoTabsInner />
    </Suspense>
  );
}
