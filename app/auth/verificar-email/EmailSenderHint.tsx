import { formatEmailSenderForDisplay, getEmailFromAddress } from '@/lib/email';

export function EmailSenderHint() {
  const sender = formatEmailSenderForDisplay(getEmailFromAddress());

  return (
    <p className="mt-6 text-xs text-center text-gray-400">
      Código válido por 5 minutos · Enviado de {sender}
    </p>
  );
}
