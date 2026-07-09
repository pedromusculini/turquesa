'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import ConfiguracoesSubNav from '@/components/ConfiguracoesSubNav';

function SubNavFallback() {
  return <div className="mb-6 h-11 animate-pulse rounded-xl bg-gray-100" />;
}

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#047482]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#047482]"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <Suspense fallback={<SubNavFallback />}>
          <ConfiguracoesSubNav />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
