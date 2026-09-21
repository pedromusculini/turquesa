import { Suspense } from 'react';
import VerificarEmailGoogleClient from './VerificarEmailGoogleClient';

export default function VerificarEmailGooglePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">Carregando...</div>
      }
    >
      <VerificarEmailGoogleClient />
    </Suspense>
  );
}
