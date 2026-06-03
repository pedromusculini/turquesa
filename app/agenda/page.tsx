'use client';

import { Suspense } from 'react';
import { useCustomSession } from '@/lib/useSession';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AgendaPageClient from '@/components/AgendaPageClient';
import { Loader2 } from 'lucide-react';

function AgendaPageInner() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
      </div>
    );
  }

  return (
    <AgendaPageClient
      userEmail={session.user?.email ?? ''}
      provider={null}
    />
  );
}

export default function AgendaPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
        </div>
      }
    >
      <AgendaPageInner />
    </Suspense>
  );
}
