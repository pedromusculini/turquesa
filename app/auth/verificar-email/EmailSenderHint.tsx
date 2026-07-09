import {
  formatEmailSenderForDisplay,
  getEmailFromAddress,
  getGmailSenderSearchUrl,
} from '@/lib/email';

export function EmailSenderHint() {
  const sender = formatEmailSenderForDisplay(getEmailFromAddress());
  const gmailSearchUrl = getGmailSenderSearchUrl();

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
      <p className="text-sm font-semibold text-amber-900">Não achou o e-mail?</p>
      <ul className="mt-2 space-y-1.5 text-xs text-amber-900/90 list-disc pl-4">
        <li>
          Verifique <strong>Spam</strong> e a aba <strong>Promoções</strong> (Gmail).
        </li>
        <li>
          O remetente é <strong className="break-all">{sender}</strong> — marque como{' '}
          <strong>não é spam</strong> se estiver na lixeira.
        </li>
        <li>Código válido por 5 minutos. Use &quot;Reenviar código&quot; se expirar.</li>
      </ul>
      <a
        href={gmailSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs font-medium text-[#047482] hover:underline"
      >
        Abrir busca no Gmail por este remetente →
      </a>
    </div>
  );
}
