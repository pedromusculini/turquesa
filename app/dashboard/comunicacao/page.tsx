'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redireciona rota antiga para Configurações. */
export default function ComunicacaoRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/configuracoes');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#228B22]" />
    </div>
  );
}
