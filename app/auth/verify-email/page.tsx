'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Rota legada → verificação pós-login Google */
export default function VerifyEmailLegacyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/verificar-email');
  }, [router]);

  return null;
}
