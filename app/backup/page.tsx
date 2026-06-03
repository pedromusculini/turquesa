'use client';

import { useCustomSession } from '@/lib/useSession';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BackupPageClient from '@/components/BackupPageClient';

export default function BackupPage() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return <div className="p-8">Carregando...</div>;
  }

  return <BackupPageClient />;
}
