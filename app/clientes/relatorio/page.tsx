'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomSession } from '@/lib/useSession';
import ClientesRelatorioClient from '@/components/ClientesRelatorioClient';

export default function ClientesRelatorioPage() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div className="p-8">Carregando relatório…</div>;
  }

  return (
    <Suspense fallback={<div className="p-8">Carregando relatório…</div>}>
      <ClientesRelatorioClient />
    </Suspense>
  );
}
