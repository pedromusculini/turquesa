import { Suspense } from 'react';
import ContaPageClient from '@/components/ContaPageClient';

export default function ContaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
          Carregando...
        </div>
      }
    >
      <ContaPageClient />
    </Suspense>
  );
}
