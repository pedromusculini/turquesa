'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ComunicacaoClient from '@/components/ComunicacaoClient';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function ConfiguracoesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#228B22]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[#228B22] font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
      </div>
      <ComunicacaoClient />
    </div>
  );
}
