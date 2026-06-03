import Link from 'next/link';
import { PRODUCT_NAME } from '@/lib/constants';
import { SUPPORT_EMAIL } from '@/lib/legal';

export default function AppFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-center text-sm text-gray-600 sm:flex-row sm:text-left">
        <p>
          © {new Date().getFullYear()} {PRODUCT_NAME} · Gestão para salões
        </p>
        <div className="flex flex-col gap-1 sm:items-end">
          <p>
            <Link href="/privacidade" className="hover:text-[#0D9488] hover:underline">
              Privacidade
            </Link>
            {' · '}
            <Link href="/termos" className="hover:text-[#0D9488] hover:underline">
              Termos
            </Link>
            {' · '}
            <Link href="/privacidade#cookies" className="hover:text-[#0D9488] hover:underline">
              Cookies
            </Link>
          </p>
          <p>
            Suporte:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-[#0D9488] hover:text-[#1B3A4B] hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
