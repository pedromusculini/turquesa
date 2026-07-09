'use client';

import { Suspense } from 'react';
import ConfigPagamentoSection from '@/components/ConfigPagamentoSection';
import ConfigCategoriasSaidaSection from '@/components/ConfigCategoriasSaidaSection';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';

function PagamentoContent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">
          Meios de pagamento e taxas usados no repasse às profissionais.
        </p>
      </div>

      <PrimeirosPassosHint
        hintId="hint-config-taxas"
        title="Taxas de pagamento"
        message="Informe a taxa de cada meio de recebimento para calcular corretamente o repasse às profissionais."
      />

      <ConfigPagamentoSection />
      <ConfigCategoriasSaidaSection />
    </div>
  );
}

export default function ConfiguracoesPagamentoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#047482]" />
        </div>
      }
    >
      <PagamentoContent />
    </Suspense>
  );
}
