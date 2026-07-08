'use client';

import { Suspense } from 'react';
import GuiaFuncionalidadesContent from '@/components/GuiaFuncionalidadesContent';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';

function GuiaDashboardContent() {
  const { startTour } = usePrimeirosPassosTour();

  return <GuiaFuncionalidadesContent modoApp onIniciarTour={startTour} />;
}

export default function GuiaDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#047482]" />
        </div>
      }
    >
      <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
        <GuiaDashboardContent />
      </div>
    </Suspense>
  );
}
