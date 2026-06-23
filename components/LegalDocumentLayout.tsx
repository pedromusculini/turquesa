import Link from 'next/link';
import {
  LEGAL_CONTACT,
  PRIVACY_CONTACT,
  PRIVACY_POLICY_VERSION,
  SUPPORT_EMAIL,
  TERMS_VERSION,
} from '@/lib/legal';

type Props = {
  title: string;
  version: string;
  children: React.ReactNode;
};

export default function LegalDocumentLayout({ title, version, children }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/" className="text-sm font-medium text-[#047482] hover:underline">
        ← Voltar ao início
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">Versão {version}</p>
      <div className="prose prose-gray mt-10 max-w-none text-gray-700 leading-relaxed space-y-4">
        {children}
      </div>
      <p className="mt-12 text-sm text-gray-500">
        Privacidade:{' '}
        <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#047482] hover:underline">
          {PRIVACY_CONTACT}
        </a>
        {' · '}
        Suporte:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#047482] hover:underline">
          {SUPPORT_EMAIL}
        </a>
        {' · '}
        Geral:{' '}
        <a href={`mailto:${LEGAL_CONTACT}`} className="text-[#047482] hover:underline">
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
      <Link href="/privacidade" className="text-[#047482] hover:underline">
        Política de Privacidade
      </Link>
      {' · '}
      <Link href="/termos" className="text-[#047482] hover:underline">
        Termos de Uso
      </Link>
      {' '}(v. {PRIVACY_POLICY_VERSION} / {TERMS_VERSION})
    </p>
  );
}
