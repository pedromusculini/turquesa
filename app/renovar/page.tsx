import { Suspense } from 'react';
import RenovarAssinaturaClient from '@/components/RenovarAssinaturaClient';

export const metadata = {
  title: 'Renovar acesso',
  robots: { index: false, follow: false },
};

export default function RenovarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          Carregando...
        </div>
      }
    >
      <RenovarAssinaturaClient />
    </Suspense>
  );
}
