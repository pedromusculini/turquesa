'use client';

import { Suspense } from 'react';
import CatalogoProfissionaisClient from '@/components/CatalogoProfissionaisClient';
import ConfiguracoesSubNav from '@/components/ConfiguracoesSubNav';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';

function EquipeContent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cadastre a equipe com comissão, cor na agenda e convite para o Google Calendar.
        </p>
      </div>

      <PrimeirosPassosHint
        hintId="hint-config-equipe"
        title="Profissionais"
        message="Cadastre a equipe com comissão e cor na agenda. Convide pelo WhatsApp para conectar o Google Calendar."
      />

      <ConfiguracoesSubNav />
      <CatalogoProfissionaisClient />
    </div>
  );
}

export default function ConfiguracoesEquipePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#047482]" />
        </div>
      }
    >
      <EquipeContent />
    </Suspense>
  );
}
