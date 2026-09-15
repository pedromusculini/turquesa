'use client';

import { Suspense } from 'react';
import PresencaSalaoClient from '@/components/PresencaSalaoClient';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';

function PresencaContent() {
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-2">
        <PrimeirosPassosHint
          hintId="hint-presenca-salao"
          title="Site do salão"
          message="Escolha estilo e cores, envie a capa e ligue o que a cliente vê. O link único substitui vários endereços soltos."
        />
      </div>
      <PresencaSalaoClient />
    </>
  );
}

export default function PresencaSalaoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#047482]" />
        </div>
      }
    >
      <PresencaContent />
    </Suspense>
  );
}
