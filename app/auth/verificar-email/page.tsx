import { Suspense } from 'react';
import VerificarEmailGoogleClient from './VerificarEmailGoogleClient';
import { EmailSenderHint } from './EmailSenderHint';

export default function VerificarEmailGooglePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">Carregando...</div>
      }
    >
      <VerificarEmailGoogleClient senderHint={<EmailSenderHint />} />
    </Suspense>
  );
}
