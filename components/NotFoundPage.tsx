import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-gray-300">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Página não encontrada</h1>
        <p className="mt-2 text-gray-600 text-sm">
          O endereço pode estar incorreto ou o conteúdo não existe mais.
        </p>
        <Link
          href="/"
          className="inline-block mt-8 px-6 py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm hover:bg-[#025201] transition"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
