'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomSession } from '@/lib/useSession';
import ClientesPageClient from '@/components/ClientesPageClient';

export default function ClientesPage() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div className="p-8">Carregando clientes...</div>;
  }

  return (
    <Suspense fallback={<div className="p-8">Carregando clientes...</div>}>
      <ClientesPageClient />
    </Suspense>
  );
}
