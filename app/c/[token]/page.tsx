'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import CatalogoPublicoShowcase from '@/components/CatalogoPublicoShowcase';
import { buildFormularioPublicPath } from '@/lib/publicFormLinks';

export default function CatalogoPublicoPage() {
  const params = useParams();
  const token = params.token as string;
  const formPath = buildFormularioPublicPath(token);

  return (
    <div className="max-w-2xl mx-auto p-6 py-10">
      <CatalogoPublicoShowcase token={token} mode="vitrine" />
      <p className="mt-8 text-center text-sm text-gray-600">
        Quer se cadastrar?{' '}
        <Link href={formPath} className="font-medium text-[#047482] hover:underline">
          Preencher formulário de cadastro
        </Link>
      </p>
      <p className="text-center text-xs text-gray-400 mt-6">Turquesa Agenda</p>
    </div>
  );
}
