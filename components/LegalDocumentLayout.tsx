import Link from 'next/link';
import { LEGAL_CONTACT, PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/legal';

type Props = {
  title: string;
  version: string;
  children: React.ReactNode;
};

export default function LegalDocumentLayout({ title, version, children }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/" className="text-sm font-medium text-[#228B22] hover:underline">
        ← Voltar ao início
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">Versão {version}</p>
      <div className="prose prose-gray mt-10 max-w-none text-gray-700 leading-relaxed space-y-4">
        {children}
      </div>
      <p className="mt-12 text-sm text-gray-500">
        Dúvidas:{' '}
        <a href={`mailto:${LEGAL_CONTACT}`} className="text-[#228B22] hover:underline">
          {LEGAL_CONTACT}
        </a>
      </p>
    </div>
  );
}

export function LegalCrossLinks() {
  return (
    <p className="text-sm text-gray-500 mt-8">
      Veja também:{' '}
      <Link href="/privacidade" className="text-[#228B22] hover:underline">
        Política de Privacidade
      </Link>
      {' · '}
      <Link href="/termos" className="text-[#228B22] hover:underline">
        Termos de Uso
      </Link>
      {' '}(v. {PRIVACY_POLICY_VERSION} / {TERMS_VERSION})
    </p>
  );
}
