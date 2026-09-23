'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ComunicacaoClient from '@/components/ComunicacaoClient';
import ConfiguracoesHub from '@/components/ConfiguracoesHub';

function ConfiguracoesLoading() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#047482]" />
    </div>
  );
}

function ConfiguracoesIndex() {
  const tab = useSearchParams().get('tab');
  if (tab === 'horarios' || tab === 'link' || tab === 'mensagens') {
    return <ComunicacaoClient />;
  }
  return <ConfiguracoesHub />;
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<ConfiguracoesLoading />}>
      <ConfiguracoesIndex />
    </Suspense>
  );
}
