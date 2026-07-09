'use client';

import { Suspense } from 'react';
import ConfigAnamneseSection from '@/components/ConfigAnamneseSection';

function AnamneseContent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">
          Campos extras no formulário público de cadastro de clientes.
        </p>
      </div>

      <ConfigAnamneseSection />
    </div>
  );
}

export default function ConfiguracoesAnamnesePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#047482]" />
        </div>
      }
    >
      <AnamneseContent />
    </Suspense>
  );
}
