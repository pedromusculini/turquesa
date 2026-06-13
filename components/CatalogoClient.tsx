'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CatalogoServicosClient from '@/components/CatalogoServicosClient';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';

function CatalogoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('tab') === 'profissionais') {
      router.replace('/dashboard/configuracoes/equipe');
    }
  }, [searchParams, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Serviços e produtos do salão.
        </p>
      </div>

      <PrimeirosPassosHint
        hintId="hint-catalogo-servicos"
        title="Serviços e produtos"
        message="Cadastre preço e duração de cada serviço — isso alimenta a agenda e o financeiro."
      />

      <CatalogoServicosClient embedded />
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
      <CatalogoContent />
    </Suspense>
  );
}
